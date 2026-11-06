const numberPattern = /^-?(?:(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3}|\d{1,4}(?:,\d{4})+)(?:\.\d*)?|\.\d+)$/;

export default class LiveNumberFormat {
    constructor(el, options = {}) {
        this.el = el;
        this.formatStyle = options.formatStyle ?? "thousand";
        this.allowNegative = options.allowNegative ?? true;
        this.decimalScale = options.decimalScale ?? Infinity;
        this.integerScale = options.integerScale ?? Infinity;
        this.stripLeadingZeroes = options.stripLeadingZeroes ?? false;
        this.formattedLabel = options.formattedLabel ?? "Formatted number";
        this.composing = false;
        this.destroyed = false;

        this.ownsOutput = !options.output;
        this.output = options.output ?? el.ownerDocument.createElement("span");
        this.originalOutputText = this.output.textContent;
        this.originalLive = this.output.getAttribute("aria-live");
        this.outputText = el.ownerDocument.createTextNode("");
        this.output.replaceChildren(this.outputText);
        this.output.setAttribute("aria-live", "off");
        if (this.ownsOutput) {
            el.insertAdjacentElement("afterend", this.output);
        }

        this.handleInput = this.handleInput.bind(this);
        this.handleCompositionStart = this.handleCompositionStart.bind(this);
        this.handleCompositionEnd = this.handleCompositionEnd.bind(this);
        this.handleReset = this.handleReset.bind(this);
        this.form = el.form;
        el.addEventListener("input", this.handleInput);
        el.addEventListener("change", this.handleInput);
        el.addEventListener("compositionstart", this.handleCompositionStart);
        el.addEventListener("compositionend", this.handleCompositionEnd);
        this.form?.addEventListener("reset", this.handleReset);
        this.refresh();
    }

    // Grouping expressions are adapted from cleave-zen under the MIT license.
    format (value) {
        const normalized = this.normalize(value);
        if (normalized === null || normalized === "") {
            return "";
        }

        const sign = normalized.startsWith("-") ? "-" : "";
        let [integer, decimal] = normalized.slice(sign.length).split(".");
        if (this.stripLeadingZeroes) {
            integer = integer.replace(/^0+(?=\d)/, "");
        }

        switch (this.formatStyle) {
            case "thousandLakhCrore":
                integer = integer.replace(/(\d)(?=(\d\d)+\d$)/g, "$1,");
                break;
            case "tenThousand":
                integer = integer.replace(/(\d)(?=(\d{4})+$)/g, "$1,");
                break;
            default:
                integer = integer.replace(/(\d)(?=(\d{3})+$)/g, "$1,");
        }

        return sign + integer + (decimal === undefined ? "" : "." + decimal);
    }

    handleInput (event) {
        if (!this.composing && !event.isComposing) {
            this.refresh();
        }
    }

    handleCompositionStart () {
        this.composing = true;
    }

    handleCompositionEnd () {
        this.composing = false;
        this.refresh();
    }

    handleReset () {
        // Reset's default action runs after event listeners and their microtasks.
        setTimeout(() => {
            if (!this.destroyed) {
                this.refresh();
            }
        }, 0 /* delay */);
    }

    refresh () {
        const formatted = this.getFormattedValue();
        // Replacing text nodes during input splits Chromium's native undo transactions.
        this.outputText.data = formatted === "" ? "" : `${this.formattedLabel}: ${formatted}`;
    }

    getRawValue () {
        return this.el.value;
    }

    getFormattedValue () {
        return this.format(this.el.value);
    }

    getFloatValue () {
        if (this.getValidationError() !== null) {
            return NaN;
        }
        return Number(this.normalize(this.el.value));
    }

    // Returns an error code without changing the input or displaying validation during typing.
    getValidationError () {
        const normalized = this.normalize(this.el.value);
        if (normalized === null) {
            return "invalidNumber";
        }
        if (normalized === "") {
            return null;
        }
        if (!this.allowNegative && normalized.startsWith("-")) {
            return "negativeNotAllowed";
        }

        const [integer, decimal = ""] = normalized.replace(/^-/, "").split(".");
        if (integer.length > this.integerScale) {
            return "integerScale";
        }
        if (decimal.length > this.decimalScale) {
            return "decimalScale";
        }
        return null;
    }

    destroy () {
        this.destroyed = true;
        this.el.removeEventListener("input", this.handleInput);
        this.el.removeEventListener("change", this.handleInput);
        this.el.removeEventListener("compositionstart", this.handleCompositionStart);
        this.el.removeEventListener("compositionend", this.handleCompositionEnd);
        this.form?.removeEventListener("reset", this.handleReset);

        if (this.ownsOutput) {
            this.output.remove();
        } else {
            this.output.textContent = this.originalOutputText;
            if (this.originalLive === null) {
                this.output.removeAttribute("aria-live");
            } else {
                this.output.setAttribute("aria-live", this.originalLive);
            }
        }
    }

    // Accept known grouping styles and normalize fullwidth digits without changing the editable value.
    normalize (value) {
        const normalized = value.trim()
            .replace(/[\uFF10-\uFF19]/g, digit => String(digit.charCodeAt(0) - 0xFF10))
            .replace(/[\uFF0D\u2212]/g, "-")
            .replace(/\uFF0E/g, ".")
            .replace(/\uFF0C/g, ",");
        if (normalized === "") {
            return "";
        }
        return numberPattern.test(normalized) ? normalized.replace(/,/g, "") : null;
    }
}
