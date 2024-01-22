export default class LiveNumberFormat {
    constructor(el, options = {}) {
        this.el = el;

        this.undoStack = []; // Stack to maintain history for undo
        this.redoStack = []; // Stack for redo

        // Debounce timer to push to undo stack
        this.debounceTimer = null;

        this.debounceTime = options.debounceTime || 300;

        this.allowNegative = options.allowNegative !== undefined ? options.allowNegative : true;

        this.formatStyle = options.formatStyle !== undefined ? options.formatStyle : "thousand";

        this.decimalMark = ".";

        this.delimiter = ",";

        this.decimalScale = options.decimalScale !== undefined ? options.decimalScale : Infinity;

        this.integerScale = options.integerScale !== undefined ? options.integerScale : Infinity;

        this.stripLeadingZeroes = options.stripLeadingZeroes !== undefined ? options.stripLeadingZeroes : false;

        // Allow another decimal mark to replace the current decimal mark
        this.allowDecimalReplacement = options.allowDecimalReplacement !== undefined ? options.allowDecimalReplacement : false;

        this.maxUndoStackSize = options.maxUndoStackSize || 500;

        this.handleInput = this.handleInput.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);

        this.backspacePressed = false;
        this.isChangeFromUndoRedo = false;

        this.init();

        if (this.el.value) {
            // Initial formatting, with cursor at the end
            this.handleInput();
            this.setCursorPosition(this.el.value.length);
        }
    }

    init () {
        this.el.addEventListener("input", this.handleInput);
        this.el.addEventListener("keydown", this.handleKeydown);
    }

    // The following function of code is sourced from `cleave-zen`
    // Licensed under the MIT License. See LICENSE in the project root for license information.
    format (value) {
        let parts, partSign, partInteger, partDecimal = '';

        // Convert the formatted string to a number representation
        value = value.replace(/[A-Za-z]/g, '')

            // replace decimals with placeholder
            .replace(this.decimalMark, 'D')

            // strip non numeric letters except minus and decimal placeholder
            .replace(/[^\dD-]/g, '')

            // replace the leading minus with minus placeholder
            .replace(/^\-/, 'M')

            // replace any other minus sign
            .replace(/\-/g, '')

            // replace minus placeholder with minus sign
            .replace('M', this.allowNegative ? '-' : '')

            // replace decimal placeholder with decimal sign
            .replace('D', this.decimalMark);

        // strip any leading zeros, while keeping minus intact
        if (this.stripLeadingZeroes) {
            value = value.replace(/^(-)?0+(?=\d)/, '$1');
        }

        partSign = value.slice(0, 1) === '-' ? '-' : '';

        parts = this.getParts(value, true, true);

        partInteger = parts.partInteger;

        // remove minus sign
        if (partSign === '-') {
            partInteger = parts.partInteger.slice(1);
        }

        // add decimal mark with the decimal value
        if (value.includes(this.decimalMark)) {
            partDecimal = this.decimalMark + parts.partDecimal;
        }

        switch (this.formatStyle) {
            case "thousandLakhCrore":
                partInteger = partInteger.replace(/(\d)(?=(\d\d)+\d$)/g, '$1' + this.delimiter);

                break;

            case "thousand":
                partInteger = partInteger.replace(/(\d)(?=(\d{3})+$)/g, '$1' + this.delimiter);

                break;

            case "tenThousand":
                partInteger = partInteger.replace(/(\d)(?=(\d{4})+$)/g, '$1' + this.delimiter);

                break;
        }

        return partSign + partInteger.toString() + (this.decimalScale > 0 ? partDecimal.toString() : '');
    }

    handleInput (e) {
        // Debounce the stack update for undo and redo
        clearTimeout(this.debounceTimer);

        let oldVal = this.el.value, cursorPosition = this.el.selectionEnd, newVal;

        // if input has only delimiters and 0, do nothing
        // e.g. 0,000,000,000 or ,000,000,000
        if (!this.stripLeadingZeroes) {
            if (oldVal.match(new RegExp(`^[${this.delimiter}0]*$`))) {
                this.isChangeFromUndoRedo = false;
                return;
            }
        }

        newVal = this.format(this.el.value); // format value

        // get the new cursor position
        const newPosition = this.getNextCursorPosition(
            cursorPosition,
            oldVal,
            newVal,
        );

        this.el.value = newVal;

        this.setCursorPosition(newPosition);

        // Push to stack only if the change is not from undo or redo
        if (!this.isChangeFromUndoRedo) {
            this.debounceTimer = setTimeout(() => {
                this.pushToUndoStack({
                    "val": newVal,
                    "cpos": newPosition
                });
            }, this.debounceTime);
        }

        this.isChangeFromUndoRedo = false;
    }

    setCursorPosition (pos) {
        pos = pos < 0 ? 0 : pos;
        this.el.setSelectionRange(pos, pos);
    }

    getNextCursorPosition (prevPos, oldValue, newValue) {
        // cursor already at the end, set it to the end of new value
        if (oldValue.length === prevPos) {
            return newValue.length;
        }
        return prevPos + this.getPositionOffset(prevPos, oldValue, newValue);
    }

    getDelimiterRegex () {
        return new RegExp(this.delimiter, 'g');
    }

    // getParts returns the integer and decimal parts of the value
    // clearDelimiters removes all delimiters from the value
    // applyScale truncates the value to the integer and decimal scales
    getParts (value, clearDelimiters = false, applyScale = false) {
        let parts = value.split(this.decimalMark);
        let partInteger = parts[0];
        let partDecimal = '';

        if (parts.length > 1) {
            partDecimal = parts[1];
        }

        if (clearDelimiters) {
            partInteger = partInteger.replace(this.getDelimiterRegex(), '');
            partDecimal = partDecimal.replace(this.getDelimiterRegex(), '');
        }

        if (applyScale) {
            partInteger = partInteger.slice(0, this.integerScale);
            partDecimal = partDecimal.slice(0, this.decimalScale);
        }

        return {
            partInteger,
            partDecimal
        };
    }

    getPositionOffset (prevPos, oldValue, newValue) {
        // Edge case for negative values,
        // e.g -2|,321,321 and user presses backspace.
        if (oldValue.startsWith("-" + this.delimiter) && newValue.startsWith("-")) {
            return 0;
        }

        let oldRawValue, newRawValue, newFormattedValueAfterCursor, oldFormattedValueAfterCursor;

        oldFormattedValueAfterCursor = oldValue.slice(prevPos);
        newFormattedValueAfterCursor = newValue.slice(prevPos);

        oldRawValue = oldValue.slice(0, prevPos).replace(this.getDelimiterRegex(), '');
        newRawValue = newValue.slice(0, prevPos).replace(this.getDelimiterRegex(), '');

        // Replace all negatives. This is done to check if the user is adding a negative sign.
        oldRawValue = oldRawValue.replace('-', '');
        newRawValue = newRawValue.replace('-', '');

        // Minus sign being added, since it was replaced in oldRawValue
        // keep cursor at the same position
        if (oldRawValue.includes("-")) {
            return -1;
        }

        // Invalid characters entered, keep cursor at the same position
        if (oldRawValue.match(/[^0-9\.-]/)) {
            return -1;
        }

        // keep cursor at the same position
        if (this.stripLeadingZeroes && oldRawValue === '0') {
            return -1;
        }

        // delimeter position changed due to backspace, move cursor to its correct position
        if (oldFormattedValueAfterCursor != newFormattedValueAfterCursor && this.backspacePressed) {
            if (oldFormattedValueAfterCursor.startsWith(this.delimiter)) {
                return -1;
            }
        }

        // Direction of cursor movement. -1 is left, 1 is right, 0 is no movement
        return Math.sign(oldRawValue.length - newRawValue.length);
    }

    handleKeydown (e) {
        this.backspacePressed = false;
        if (e.key === "Backspace") {
            this.backspacePressed = true;
        } else if (e.key === "ArrowLeft" && !e.shiftKey) {
            this.handleLeftArrow(e);
            return;
        } else if (e.key === "ArrowRight" && !e.shiftKey) {
            this.handleRightArrow(e);
            return;
        } else if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
            this.performUndo(e);
            return;
        } else if (e.ctrlKey && (e.key === "y" || e.key === "Y")) {
            this.performRedo(e);
            return;
        } else if (e.key === "Delete") {
            // if cursor is before delimiter and is NOT at index 0, move cursor 1 place right
            if (this.el.value[this.el.selectionStart] === this.delimiter && this.el.selectionStart != 0) {
                e.preventDefault();
                this.setCursorPosition(this.el.selectionStart + 1);
            }
            return;
        }

        // prevent typing another decimal mark or if the decimal scale is 0
        if (e.key === this.decimalMark) {
            if ((this.allowDecimalReplacement === false && this.el.value.includes(this.decimalMark))  || this.decimalScale === 0) {
                e.preventDefault();
            }
        }

        // For no range cursor selection, check if input is greater than the scales.
        if (this.el.selectionStart === this.el.selectionEnd) {

            // restrict input to integer and decimal scales
            if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key)) {

                // Find the cursor position if on left or right of decimal mark
                let parts = this.getParts(this.el.value, true);
                let delimeterCount = this.el.value.split(this.delimiter).length - 1;

                // subtract delimeter count from cursor position to get the correct position of cursor
                let cursorPositionFromStart = this.el.selectionStart - delimeterCount;

                // cursor is on left of decimal mark
                if (cursorPositionFromStart <= parts.partInteger.length) {
                    if (parts.partInteger.length >= this.integerScale) {
                        e.preventDefault();
                    }
                }

                // cursor is on right of decimal mark
                if (cursorPositionFromStart > parts.partInteger.length) {
                    if (parts.partDecimal.length >= this.decimalScale) {
                        e.preventDefault();
                    }
                }
            }
        }
    }

    // handleLeftArrow moves cursor 2 places if previous character is delimiter
    handleLeftArrow (e) {
        const cursorPositionFromStart = this.el.selectionStart;

        // if previous character is delimiter, move cursor 2 places
        if (cursorPositionFromStart - 2 < 0) {
            return;
        }

        if (this.el.value[cursorPositionFromStart - 2] === this.delimiter) {
            e.preventDefault();
            this.setCursorPosition(cursorPositionFromStart - 2);
        }
    }

    // handleRightArrow moves cursor 2 places if next character is delimiter
    handleRightArrow (e) {
        const cursorPositionFromStart = this.el.selectionStart;

        // if next character is delimiter, move cursor 2 places
        if (this.el.value[cursorPositionFromStart] === this.delimiter) {
            e.preventDefault();
            this.setCursorPosition(cursorPositionFromStart + 2);
        }
    }

    pushToUndoStack (value) {
        if (this.undoStack.length <= this.maxUndoStackSize) {
            this.undoStack.push(value);
            this.redoStack = []; // Clear redo stack on new input
        }
    }

    // performUndo does an undo operation, sets new value & adjusts cursor position
    performUndo () {
        this.isChangeFromUndoRedo = true;
        if (this.undoStack.length > 1) {
            let currentState = this.undoStack.pop();
            this.redoStack.push(currentState);

            let itemToSet = this.undoStack[this.undoStack.length - 1];
            this.el.value = itemToSet.val;
            this.setCursorPosition(itemToSet.cpos);
        } else if (this.undoStack.length === 1) {
            this.redoStack.push(this.undoStack.pop());
            this.el.value = "";
        }
    }

    // performRedo does a redo operation, sets new value & adjusts cursor position
    performRedo () {
        this.isChangeFromUndoRedo = true;
        if (this.redoStack.length > 0) {
            let itemToRedo = this.redoStack.pop();
            this.undoStack.push(itemToRedo);
            this.el.value = itemToRedo.val;
            this.setCursorPosition(itemToRedo.cpos);
        }
    }

    destroy () {
        this.el.removeEventListener("input", this.handleInput);
        this.el.removeEventListener("keydown", this.handleKeydown);
    }

    getRawValue () {
        return this.el.value;
    }

    getFloatValue () {
        let value = this.getRawValue();
        if (value) {
            value = value.match(/[0-9.-]+/g).join('');
        }
        return isNaN(parseFloat(value)) === true ? 0 : parseFloat(value);
    }

}
