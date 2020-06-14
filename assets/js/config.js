//? |-----------------------------------------------------------------------------------------------|
//? |  /assets/js/config.js                                                                         |
//? |                                                                                               |
//? |  Copyright (c) 2018-2020 Belikhun. All right reserved                                         |
//? |  Licensed under the MIT License. See LICENSE in the project root for license information.     |
//? |-----------------------------------------------------------------------------------------------|

const sbar = new statusBar(document.body);
sbar.additem(USERNAME, "account", {space: false, align: "left"});

document.__onclog = (type, ts, msg) => {
    type = type.toLowerCase();
    const typeList = ["okay", "warn", "errr", "crit", "lcnt"]
    if (typeList.indexOf(type) === -1)
        return false;

    sbar.msg(type, msg, {time: ts, lock: (type === "crit" || type === "lcnt") ? true : false});
}

popup.init();

const config = {
	container: $("#formContainer"),
	configContainer: $("#configContainer"),

	configItem: {},
	configTree: {},

    async init() {
		if (cookie.get("__darkMode") === "true")
        	document.body.classList.add("dark");

		if (window.frameElement)
			document.body.classList.add("embeded");

		tooltip.init();
		await sounds.init();
		await this.render();

		this.container.addEventListener("submit", () => this.saveSettings());
	},

	__setTreePath(object, path = [], value) {
		let _p = "";

		for (let p of path) {
			_p += `["${p}"]`;

			if (eval(`typeof object${_p} !== "object"`))
				eval(`object${_p} = {}`);
		}

		eval(`object${_p} = value`);
		return object;
	},

	__render(item, container, path = []) {
		if (item.type) {
			let itemData = {}
			let keyPath = path.join(".");

			switch (item.type) {
				case "text":
				case "number": {
					let textInput = createInput({
						type: item.type,
						id: `config.${keyPath}`,
						label: item.label,
						value: item.value,
						color: item.color || "blue",
						required: item.required || false
					})

					if (item.height)
						textInput.input.style.height = item.height;
	
					if (item.step)
						textInput.input.step = item.step;

					textInput.group.classList.add("sound");
					textInput.group.dataset.soundselectsoft = true;
					sounds.applySound(textInput.group);

					itemData = {
						type: item.type,
						node: textInput.group,
						setValue: (value) => textInput.input.value = value,
						getValue: () => (item.type === "number") ? parseInt(textInput.input.value) : textInput.input.value
					}

					break;
				}
				
				case "checkbox": {
					let switchInput = createSwitch({
						label: item.label,
						color: item.color || "blue",
						value: item.value
					})

					itemData = {
						type: item.type,
						node: switchInput.group,
						setValue: (value) => switchInput.input.checked = value,
						getValue: () => switchInput.input.checked
					}

					break;
				}

				case "note": {
					container.classList.add("lr", item.level);

					let node = `
						<div class="left">${item.text}</div>
						<div class="right"></div>
					`

					itemData = {
						type: item.type,
						node,
						ignore: true
					}

					break;
				}

				case "image": {
					let node = document.createElement("div");
					node.classList.add("configImageInput");

					let input = document.createElement("input");
					input.type = "file";
					input.id = `config.${keyPath}`;
					input.accept = "image/*";

					let imageContainer = document.createElement("label");
					imageContainer.htmlFor = input.id;
					imageContainer.dataset.soundhover = true;
					imageContainer.dataset.soundselect = true;
					sounds.applySound(imageContainer);

					let lazyloadImage = new lazyload({
						container: imageContainer,
						source: item.api,
						classes: ["imageBox", item.display || "square"]
					});

					let resetButton = document.createElement("button");
					resetButton.type = "button";
					resetButton.classList.add("sq-btn", "pink", "sound");
					resetButton.innerText = "Đặt Lại";
					resetButton.dataset.soundhover = true;
					resetButton.dataset.soundselect = true;
					sounds.applySound(resetButton);
					
					input.addEventListener("change", async e => {
						sounds.confirm(2);
						let file = e.target.files[0];
				
						try {
							await myajax({
								url: item.api,
								method: "POST",
								form: {
									token: API_TOKEN,
									file: file
								}
							})
						} catch(e) { errorHandler(e); sounds.warning() }
				
						e.target.value = "";
						lazyloadImage.src = item.api;
					})
				
					resetButton.addEventListener("mouseup", async () => {
						sounds.notification();
				
						try {
							await myajax({
								url: item.api,
								method: "DELETE",
								header: { token: API_TOKEN }
							})
						} catch(e) { errorHandler(e); sounds.warning() }
				
						lazyloadImage.src = item.api;
					})

					node.append(input, imageContainer, resetButton);

					itemData = {
						type: item.type,
						node,
						ignore: true
					}

					break;
				}

				case "datetime": {
					let node = document.createElement("div");
					node.classList.add("item", "flex-row");

					let dateInput = createInput({
						type: "date",
						id: `config.${keyPath}.date`,
						label: `Ngày`,
						color: item.color || "blue"
					});

					dateInput.group.classList.add("item");

					let timeInput = createInput({
						type: "time",
						id: `config.${keyPath}.time`,
						label: `Thời Gian`,
						color: item.color || "blue"
					});

					timeInput.group.classList.add("item");
					timeInput.input.step = 1;

					let setNow = document.createElement("button");
					setNow.type = "button";
					setNow.classList.add("sq-btn", "blue", "sound");
					setNow.innerText = "🕒 Hiện Tại";
					setNow.dataset.soundhover = true;
					setNow.dataset.soundselect = true;
					sounds.applySound(setNow);

					setNow.addEventListener("mouseup", e => setDateTimeValue(dateInput.input, timeInput.input));
					setDateTimeValue(dateInput.input, timeInput.input, item.value);

					node.append(dateInput.group, timeInput.group, setNow);

					itemData = {
						type: item.type,
						node,
						setValue: (value) => setDateTimeValue(dateInput.input, timeInput.input, value),
						getValue: () => getDateTimeValue(dateInput.input, timeInput.input)
					}

					break;
				}

				case "range": {
					let node = document.createElement("div");
					node.classList.add("configRangeInput");
					node.dataset.soundhoversoft = true;

					let previewContainer = document.createElement("div");
					previewContainer.classList.add("lr");

					let previewLabel = document.createElement("t");
					previewLabel.classList.add("left");
					previewLabel.innerText = item.label;

					let previewValue = document.createElement("t");
					previewValue.classList.add("right");

					previewContainer.append(previewLabel, previewValue);

					let input = document.createElement("input");
					input.type = "range";
					input.classList.add("sq-slider", "blue");
					input.min = item.min;
					input.max = item.max;
					input.step = (typeof item.step === "number") ? item.step : 1;
					input.dataset.soundselectsoft = true;
					input.dataset.soundchange = true;
					sounds.applySound(input);

					input.addEventListener("input", e => {
						let _o = parseInt(e.target.value);
						let value = (item.valueList) ? item.valueList[_o] : _o;
				
						previewValue.innerText = `${value} ${item.unit || "ĐV"}`;

						if (e.isTrusted)
							tooltip.show(previewValue.innerText, e.target);
				
						if (item.valueWarn) {
							let _p =
								(item.valueWarn.type === "lower")
									? (value < item.valueWarn.value)
									: (value > item.valueWarn.value);

							input.className = `sq-slider ${_p ? (item.valueWarn.color || "pink") : "blue"}`;
						}
					})

					input.value = item.value;
					input.dispatchEvent(new Event("input"));

					node.append(previewContainer, input);

					itemData = {
						type: item.type,
						node,
						setValue: (value) => { input.value = value; input.dispatchEvent(new Event("input")); },
						getValue: () => parseInt(input.value)
					}

					break;
				}

				default:
					itemData = {
						type: item.type,
						node: htmlToElement(`<t>Unknown Item Type: ${item.type}</t>`),
						ignore: true
					}
					break;
			}

			itemData.path = path;

			if (item.note)
				container.dataset.tip = item.note;

			if (typeof itemData.node === "object" && itemData.node.classList)
				container.appendChild(itemData.node);
			else
				container.innerHTML += itemData.node;

			this.configItem[keyPath] = itemData;
			this.__setTreePath(this.configTree, path, itemData);
		} else {
			let keysList = Object.keys(item).filter(i => i.substr(0, 2) !== "__");

			for (let key of keysList) {
				let value = item[key];
				value.__key = key;

				if (typeof value !== "object" || key.substr(0, 2) === "__")
					continue;

				let _p = [ ...path ];
				_p.push(key);

				let itemContainer = document.createElement("div");
				itemContainer.dataset.path = _p.join(".");
				
				if (value.__icon && value.__title) {
					itemContainer.classList.add("group", value.__icon);
					itemContainer.innerHTML = `<t class="title">${value.__title}</t>`;
				} else {
					itemContainer.classList.add("item", "sound");
					itemContainer.dataset.soundhoversoft = true;

					if (value.__display)
						itemContainer.classList.add(`flex-${value.__display}`);

					if (value.__title)
						itemContainer.innerHTML = `<t class="title small">${value.__title}</t>`;

					sounds.applySound(itemContainer);
				}

				this.__render(value, itemContainer, _p);
				container.appendChild(itemContainer);
			}
		}
	},

	async render() {
		let request = await myajax({
			url: "/api/config",
			method: "GET",
			query: {
				type: "structure"
			}
		});

		this.configItem = {}
		this.configTree = {}
		emptyNode(this.configContainer);

		this.__render(request.data, this.configContainer);
		await this.updateSettings();
	},

	__setSetting(item, path = []) {
		if (typeof item === "object")
			for (let key of Object.keys(item)) {
				let _p = [ ...path ];
				_p.push(key);

				this.__setSetting(item[key], _p);
			}
		else {
			let keyPath = path.join(".");

			if (this.configItem[keyPath] && !this.configItem[keyPath].ignore)
				this.configItem[keyPath].setValue(item);
		}
	},

	async updateSettings() {
		clog("DEBG", "Updating Settings");

		let request = await myajax({
			url: "/api/config",
			method: "GET"
		});

		this.__setSetting(request.data);
	},

	__getSettings(item = this.configTree, path = []) {
		if (typeof item === "object" && typeof item.getValue !== "function") {
			let value = {}

			for (let key of Object.keys(item)) {
				let i = item[key];

				if (i.ignore)
					continue;

				let _p = [ ...path ];
				_p.push(key);

				value[key] = this.__getSettings(item[key], _p);
			}

			return value;
		} else
			return item.getValue();
	},

	async saveSettings() {
		try {
			await myajax({
				url: "/api/config",
				method: "POST",
				header: {
					token: API_TOKEN
				},
				json: this.__getSettings()
			});
		} catch(e) {
			errorHandler(e);
			return;
		}

		clog("OKAY", "Thay đổi cài đặt thành công");
		await this.updateSettings();
	}
}

document.body.onload = () => config.init().catch(e => errorHandler(e));