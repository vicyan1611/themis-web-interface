//? |-----------------------------------------------------------------------------------------------|
//? |  /assets/js/editor.js                                                                         |
//? |                                                                                               |
//? |  Copyright (c) 2018-2021 Belikhun. All right reserved                                         |
//? |  Licensed under the MIT License. See LICENSE in the project root for license information.     |
//? |-----------------------------------------------------------------------------------------------|

"use strict";

/**
 * My custom simple editor, inspired by the
 * Monaco editor (because I can't find any
 * clean way to implement monaco editor into
 * my project 😭😭😭)
 * 
 * @author		@belivipro9x99
 * @version		v1.0
 */
class Editor {
	/**
	 * Initialize a new editor
	 * 
	 * @param	{HTMLTextAreaElement}		container
	 * @author	@belivipro9x99
	 */
	constructor(container, {
		value,
		language = "text",
		tabSize = 4
	} = {}) {
		//* ==================== Setup Variables ====================

		/**
		 * Store raw value as array of line
		 * @type {Array}
		 */
		this.rawValue = [];

		/**
		 * Store tab size
		 * @type {Number}
		 */
		this.__tabSize = 4;

		/**
		 * Store timeout id to turn on cavet smooth animation
		 * @type {Number}
		 */
		this.cavetTimeout;

		/**
		 * Detect if user is selecting range of text
		 */
		this.isSelecting = false;

		/**
		 * Current line that the cursor are in
		 * @type {HTMLElement}
		 */
		this.currentLine = 0;

		/** @type {String} */
		this.language = language;

		this.cStart = { line: 0, pos: 0 }
		this.cEnd = { line: 0, pos: 0 }
		this.cCursor = { line: 0, pos: 0 }

		//* ==================== Setup Editor Structure ====================
		/** @type {HTMLTextAreaElement} */
		this.container = buildElementTree("div", "editor", [
			{ type: "div", class: "check", name: "check" },
			{ type: "span", class: "lineNum", name: "lineNum" },

			{ type: "div", class: "main", name: "main", list: [
				{ type: "div", class: "selections", name: "selections" },
				{ type: "div", class: ["cursor", "smooth"], name: "cursor" },
				{ type: "span", class: "code", name: "code" },
				{ type: "textarea", class: "overlay", name: "overlay" }
			]},
		]).obj;

		this.container.id = container.id;
		container.parentElement.replaceChild(this.container, container);
		if (typeof Scrollable === "function")
			new Scrollable(this.container, { animation: false });

		this.main = this.container.main;
		this.main.overlay.spellcheck = false;
		this.setup();

		this.value = value;
		this.tabSize = tabSize;
	}

	/**
	 * @param {String} value
	 */
	set value(value) {
		this.main.overlay.value = value;
		this.update();
	}

	get value() {
		return this.main.overlay.value;
	}

	/**
	 * @param {Number} tabSize
	 */
	set tabSize(tabSize) {
		this.main.style.tabSize = tabSize;
		this.__tabSize = tabSize;
	}

	/**
	 * @returns	{Number}
	 */
	get tabSize() {
		return this.__tabSize;
	}

	/**
	 * Return an array of line elements
	 * @type {Array}
	 */
	get lines() {
		return this.__lines;
	}

	/**
	 * Return an array of line number elements
	 * @type {Array}
	 */
	get lineNums() {
		return this.__lineNums;
	}

	/**
	 * Return an array of selection elements
	 * @type {Array}
	 */
	get selections() {
		return this.main.selections.childNodes;
	}

	setup() {
		this.main.overlay.addEventListener("keydown", (e) => {
			switch (e.keyCode) {
				case 13:
					// Enter Key
					this.insertNewLine(this.cCursor.line + 1);
					break;

				case 8:
					// Backspace Key
					// Remove the line the cursor is
					// currently on if the cursor is
					// in the first position
					if (this.cCursor.pos === 0)
						this.removeLine(this.cCursor.line);
					
					break;
			
				default:
					break;
			}
		});

		this.main.overlay.addEventListener("input", (e) => {
			console.log(e);

			switch (e.inputType) {
				case "historyUndo":
				case "insertFromPaste":
					this.update();
					break;
			
				default:
					this.update({
						from: Math.max(this.cStart.line - 1, 0),
						to: this.cEnd.line + 1
					});
					break;
			}
		});

		this.main.overlay.addEventListener("click", () => this.updateCaret());
		this.main.overlay.addEventListener("mousedown", () => this.isSelecting = true);
		this.main.overlay.addEventListener("mouseup", () => this.isSelecting = false);
		this.main.overlay.addEventListener("keydown", () => this.updateCaret());

		window.addEventListener("mousemove", () => {
			if (this.isSelecting)
				this.updateCaret();
		});

		new ResizeObserver(() => this.updateSizing()).observe(this.container);
	}

	async updateCaret() {
		// Some events happend before the
		// input update new value so we
		// need to wait for next frame to
		// get updated information
		await nextFrameAsync();

		clearTimeout(this.cavetTimeout);
		this.main.cursor.classList.remove("smooth");

		// Calculate cStart and cEnd
		this.cStart = this.calcPoint(this.main.overlay.selectionStart);
		this.cEnd = this.calcPoint(this.main.overlay.selectionEnd);
		this.cCursor = (this.main.overlay.selectionDirection === "forward")
			? this.cEnd
			: this.cStart;

		// Draw Selection Area
		if (this.main.overlay.selectionStart !== this.main.overlay.selectionEnd)
			this.updateSelection(this.cStart, this.cEnd);
		else
			emptyNode(this.main.selections);

		// Update active line
		if (this.currentLine !== this.cCursor.line) {
			if (typeof this.currentLine === "number") {
				this.lines[this.currentLine].classList.remove("active");
				this.lineNums[this.currentLine].classList.remove("active");
			}
	
			this.currentLine = this.cCursor.line;
			this.lines[this.currentLine].classList.add("active");
			this.lineNums[this.currentLine].classList.add("active");
		}

		// Calculate caret position
		let topPos = this.lines[this.cCursor.line].offsetTop;
		let leftPos = this.stringWidth(this.lineValue(this.cCursor.line).slice(0, this.cCursor.pos));

		this.main.cursor.style.top = `${topPos}px`;
		this.main.cursor.style.left = `${leftPos}px`;

		// Update caret style and inline character
		this.main.cursor.style.height = `${this.lines[this.cCursor.line].getBoundingClientRect().height}px`;
		this.main.cursor.innerText = this.lineValue(this.cCursor.line)[this.cCursor.pos] || " ";

		this.cavetTimeout = setTimeout(() => {
			this.main.cursor.classList.add("smooth");
		}, 500);
	}

	updateSelection(start = { line: 0, pos: 0 }, end = { line: 0, pos: 0 }) {
		emptyNode(this.main.selections);

		for (let line = start.line; line <= end.line; line++) {
			let lineRect = this.lines[line].getBoundingClientRect();
			let top = this.lines[line].offsetTop;
			
			let r = document.createElement("div");
			r.style.top = `${top}px`;
			r.style.height = `${lineRect.height}px`;

			let l = this.lineValue(line);
			if (start.line === end.line) {
				// Only 1 line is selected
				r.style.left = `${this.stringWidth(l.slice(0, start.pos))}px`;
				r.style.width = `${this.stringWidth(l.slice(start.pos, end.pos))}px`;
			} else if (line === start.line) {
				// First line
				r.style.left = `${this.stringWidth(l.slice(0, start.pos))}px`;
				r.style.width = `${this.stringWidth(l.slice(start.pos, l.length) + " ")}px`;
			} else if (line === end.line) {
				r.style.left = 0;
				r.style.width = `${this.stringWidth(l.slice(0, end.pos))}px`;
			} else {
				r.style.left = 0;
				r.style.width = `${this.stringWidth(l + " ")}px`;
			}

			this.main.selections.appendChild(r);
		}
	}

	setCaret({
		line = 0,
		pos = 0
	} = {}) {
		let r = document.createRange();
		let s = window.getSelection();

		r.setStart(this.lines[line].childNodes[0], pos);
		r.collapse(true);

		s.removeAllRanges();
		s.addRange(r);
		this.updateCaret();
	}

	stringWidth(string) {
		this.container.check.innerText = string;
		return this.container.check.getBoundingClientRect().width;
	}

	lineValue(i) {
		return this.lines[i].innerText;
	}

	calcMaxC() {
		return this.main.getBoundingClientRect().width / this.stringWidth(" ");
	}

	calcPoint(offset) {
		let lines = this.value.split("\n");
		let line = 0;

		while ((lines[line].length + 1) <= offset) {
			offset -= (lines[line].length + 1);
			line++;
		}

		return {
			line,
			pos: offset
		}
	}

	insertString(insert) {
		let s = window.getSelection();
		let r = s.getRangeAt(0);
		
		let iNode = document.createTextNode(insert);

		r.deleteContents();
		r.insertNode(iNode);
		r.collapse(false);
		r.setStartAfter(iNode);
		r.setEndAfter(iNode);

		s.removeAllRanges();
		s.addRange(r);

		this.updateCaret();
	}

	/**
	 * Backtrace to find line element
	 * @param {HTMLElement}	e 
	 */
	getLine(e) {
		while ((!e.classList || !e.classList.contains("line")) && e.parentElement)
			e = e.parentElement;

		return e;
	}

	getLineNth(e) {
		for (let i = 0; i < this.main.code.childNodes.length; i++)
			if (this.main.code.childNodes[i] === e)
				return i;
		
		return null;
	}

	insertNewLine(pos) {
		let l = document.createElement("div");
		l.classList.add("line");
		l.setAttribute("line", pos);

		if (this.lines[pos - 1] && this.lines[pos - 1].nextSibling)
			this.main.code.insertBefore(l, this.lines[pos - 1].nextSibling);
		else
			this.main.code.appendChild(l);

		return l;
	}

	removeLine(pos) {
		this.main.code.removeChild(this.lines[pos]);
		this.updateValues();
	}

	updateSizing() {
		this.main.overlay.style.width = `${this.main.overlay.scrollWidth}px`;
		this.main.overlay.style.height = `${this.main.overlay.scrollHeight}px`;
	}

	updateValues() {
		this.__lines = this.main.code.childNodes;
		this.__lineNums = this.container.lineNum.childNodes;
	}

	parseTokens(line) {
		return line;
	}

	update({
		from,
		to,
		full = false
	} = {}) {
		let t0 = performance.now();

		let value = this.main.overlay.value.split("\n");
		this.updateValues();
		this.updateSizing();

		if (!from)
			from = 0;

		if (!to)
			to = value.length - 1;

		console.log("update", from, to);
		let inModified = false;

		for (let i = from; i <= to; i++) {
			if (value[i] === "")
				value[i] = " ";

			if (!this.lines[i])
				this.insertNewLine(i);

			const doUpdate = () => {
				console.log("update line", i);
				this.lines[i].innerHTML = this.parseTokens(value[i]);
			}

			// When full update is not applied,
			// scan for a specific zone that got
			// modified
			if (!full) {
				// If not in modified zone, scan until
				// found line different
				if (!inModified) {
					if (this.lines[i].innerText !== value[i]) {
						inModified = true;
						doUpdate();
					}
				} else {
					// If we got out of modified zone,
					// stop the loop
					if (this.lines[i].innerText === value[i])
						break;
	
					doUpdate();
				}
			} else
				doUpdate();
			
			let ln = this.container.lineNum.querySelector(`div[line="${i}"]`);
			if (!ln) {
				// Line number
				ln = document.createElement("div");
				ln.innerText = (i + 1);
				ln.setAttribute("line", i);

				let n = this.container.lineNum.querySelector(`div[line="${i - 1}"]`);
				if (n && n.nextSibling)
					this.container.lineNum.insertBefore(ln, n.nextSibling);
				else
					this.container.lineNum.appendChild(ln);
			}

			ln.style.height = `${this.lines[i].getBoundingClientRect().height}px`;
		}

		while (this.lines.length > value.length)
			this.main.code.removeChild(this.main.code.lastChild);

		while (this.lineNums.length > value.length)
			this.container.lineNum.removeChild(this.container.lineNum.lastChild);

		if (this.currentLine > value.length - 1)
			this.currentLine = null;

		this.updateCaret();
		let t1 = performance.now();

		console.log(t1 - t0);
	}
}