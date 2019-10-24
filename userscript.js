// ==UserScript==
// @name        HTTPOnly Password Protection
// @description Скрипт защищает все парольные поля от доступа со стороны JavaScript.
// @run-at      document-start
// @match       *://*/*
// @grant       none
// @author      L7K
// @license     GPL-3.0-or-later
// ==/UserScript==

(function()
{
        'use strict';
	//Константы
	const PASSWORD_PLACEHOLDER = "Здесь мог быть пароль, но его нет"; //Фраза, которую отдает input.value вместо пароля
	const KEYBOARD_EVENT_STRING_PLACEHOLDER = "";
	const KEYBOARD_EVENT_NUMERIC_PLACEHOLDER = 0;

	const keyboardEventLeakSourcesString = [
	"char", "code", "key", "keyIdentifier" ];

	const keyboardEventLeakSourcesNumber = [
		"charCode", "keyLocation", "keyCode", "location", "which"
	];


	let inputTypeOriginalDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "type");
	let inputNameOriginalDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "name");

	let isThisAPassword = function(inputField)
	{
		return ((inputField instanceof HTMLInputElement) && (inputTypeOriginalDescriptor.get.call(inputField).toLowerCase() == "password"));
	};

	//1. Заблокировать изменение input.type с "password" на любое другое значение
	let setInputType = function(inputElementType) {
		if (!isThisAPassword(this))
		{
			inputTypeOriginalDescriptor.set.call(this, inputElementType);
		}
	};
	Object.defineProperty(HTMLInputElement.prototype, "type", {configurable: true, get: inputTypeOriginalDescriptor.get, set: setInputType});

	let typeAttributeOriginalSetter = Element.prototype.setAttribute;
	let typeAttributeOriginalGetter = Element.prototype.getAttribute;
	let typeAttributeProtectedSetter = function(attributeName, attributeValue) {
		if (!isThisAPassword(this) || (attributeName.toLowerCase() != "type"))
		{
			typeAttributeOriginalSetter.call(this, attributeName, attributeValue);
		}
	};
	Object.defineProperty(Element.prototype, "setAttribute", {configurable: true, writable: false, value: typeAttributeProtectedSetter});
	Object.defineProperty(Element.prototype, "getAttribute", {configurable: true, writable: false, value: typeAttributeOriginalGetter});

	//2. Запретить чтение input.value для паролей
	let inputValueOriginalDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

	let getInputValue = function() {
		if (isThisAPassword(this))
		{
			return PASSWORD_PLACEHOLDER;
		}
		else
		{
			return inputValueOriginalDescriptor.get.apply(this);
		}
	};
	
	Object.defineProperty(HTMLInputElement.prototype, "value", {configurable: true, get: getInputValue});

	//3. Запретить считывание нажатий клавиш в поле ввода пароля
	//3.1. Не регистрировать обработчики клавиатурных событий для полей ввода паролей
	let addInputEventListenerOriginal = EventTarget.prototype.addEventListener;
	EventTarget.prototype.addEventListener = function(listenerType, listener)
	{
		if (!isThisAPassword(this) || (!listenerType.toLowerCase().startsWith("key")))
		{
			addInputEventListenerOriginal.apply(this, arguments);
		}
	}

	//3.2. Предотвратить считывание нажатий клавиш через обработчики событий элемента, внутри которого находится поле ввода пароля
	let redefineKeyboardEventGetters = function (targetPrototype)
	{
		for (let i = 0; i < keyboardEventLeakSourcesString.length; i++)
		{
			let originalPropertyDescriptor = Object.getOwnPropertyDescriptor(targetPrototype, keyboardEventLeakSourcesString[i]);
			if (originalPropertyDescriptor)
			{
				let protectedPropertyGetter = function()
				{
					if (isThisAPassword(this.target))
					{
						return KEYBOARD_EVENT_STRING_PLACEHOLDER;
					}
					else
					{
						return originalPropertyDescriptor.get.call(this);
					}
				};
				Object.defineProperty(targetPrototype, keyboardEventLeakSourcesString[i], {configurable: true, get: protectedPropertyGetter, set: originalPropertyDescriptor.set });
			}
		}
	
		for (let i = 0; i < keyboardEventLeakSourcesNumber.length; i++)
		{
			let key = keyboardEventLeakSourcesNumber[i];
			let originalPropertyDescriptor = Object.getOwnPropertyDescriptor(targetPrototype, key);
			if (originalPropertyDescriptor)
			{
				let protectedPropertyGetter = function()
				{
					if (isThisAPassword(this.target))
					{
						return KEYBOARD_EVENT_NUMERIC_PLACEHOLDER;
					}
					else
					{
						return originalPropertyDescriptor.get.call(this);
					}
				};
				Object.defineProperty(targetPrototype, key, {configurable: true, get: protectedPropertyGetter, set: originalPropertyDescriptor.set });
			}
		}
	};

	redefineKeyboardEventGetters(KeyboardEvent.prototype);
	redefineKeyboardEventGetters(UIEvent.prototype); // для UIEvent.which

	//4. Предотвратить считывание паролей из FormData
	class ProtectedFormData extends FormData
	{
		constructor(form)
		{
			super(form);
			if (form)
			{
				//this.form = form;
				let passwordFields = form.querySelectorAll("input[type='password']");
				for (let i = 0; i < passwordFields.length; i++)
				{
					let key = inputNameOriginalDescriptor.get.call(passwordFields[i]);
					if (key && (key.length > 0))
					{
						this.delete(key);
						this.set(key, PASSWORD_PLACEHOLDER);
					}
				}
			}
		}
	}
	FormData = ProtectedFormData;
})();
