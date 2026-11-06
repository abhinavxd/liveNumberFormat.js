# liveNumberFormat.js

Live number formatting with a separate preview and native text editing.

The input keeps exactly what the user enters. A separate preview displays grouping separators as they type. Keyboard navigation, selection, undo, paste, and composition stay under browser control.

[View demo](https://abhinavxd.github.io/liveNumberFormat.js/) or read the [demo source](docs/index.html).

## Usage

```sh
npm i live-number-format
```

```html
<label for="amount">Amount</label>
<p id="amount-help">Use a period for decimals. Formatting appears below.</p>
<input id="amount" name="amount" type="text" aria-describedby="amount-help" />
<p id="amount-preview"></p>
```

```javascript
import LiveNumberFormat from "live-number-format";

const input = document.getElementById("amount");
const formatter = new LiveNumberFormat(input, {
    output: document.getElementById("amount-preview"),
    formatStyle: "thousand",
    stripLeadingZeroes: false,
    allowNegative: true,
    integerScale: Infinity,
    decimalScale: Infinity,
    formattedLabel: "Formatted number",
});
```

Entering `1234567.89` keeps that input value and displays `Formatted number: 1,234,567.89` below it.

## Options

| Option | Default | Behavior |
| --- | --- | --- |
| `output` | Generated span after the input | A dedicated, empty element for the preview. |
| `formatStyle` | `"thousand"` | Also supports `"thousandLakhCrore"` and `"tenThousand"`. |
| `stripLeadingZeroes` | `false` | Removes leading zeroes from the preview only. |
| `allowNegative` | `true` | Makes negative values invalid when false. |
| `integerScale` | `Infinity` | Maximum integer digits accepted by validation, excluding the sign and separators. |
| `decimalScale` | `Infinity` | Maximum decimal digits accepted by validation. |
| `formattedLabel` | `"Formatted number"` | Visible preview label, which can be translated. |

The preview is available through normal screen reader navigation. Its `aria-live` is set to `off` to avoid announcing the full formatted number on every keystroke. Composition updates wait until the text is committed.

Input labels and descriptions stay unchanged. Keep instructions static. Linking a changing preview through `aria-describedby` can make screen readers repeat the description during typing.

Formatting accepts ungrouped numbers, the three supported grouping styles, fullwidth digits and punctuation, and the Unicode minus sign. Decimals use a period. Other input stays intact for the user to correct.

## Reading values and validation

| Method | Result |
| --- | --- |
| `getRawValue()` | The unchanged input string. |
| `getFormattedValue()` | The formatted string, or an empty string when the input cannot be parsed. |
| `getFloatValue()` | A JavaScript number, `0` for empty input, or `NaN` for invalid input. |
| `getValidationError()` | An error code or `null`. No DOM changes or error announcements. |
| `format(value)` | Formats a string without modifying the input. |
| `refresh()` | Updates the preview after assigning a value or changing options programmatically. |
| `destroy()` | Removes listeners and generated markup, restoring the supplied preview and preserving unrelated descriptions. |

Validation returns `invalidNumber`, `negativeNotAllowed`, `integerScale`, or `decimalScale`. Empty input is valid for an optional field. Required fields must also check for an empty value.

Validate when submitting the form. Associate a visible error with the input through `aria-describedby`, set `aria-invalid`, and announce the error. After a failed submission, errors can update as the user corrects them. The demo includes this complete flow.

Digit limits never truncate input. For example, `12345.678` remains intact with `integerScale: 3` and `decimalScale: 2`. Validation reports the exceeded limit.

Use strings when preserving numeric precision matters. `getFloatValue()` follows JavaScript number conversion and can round long values.

```javascript
formatter.formatStyle = "thousandLakhCrore";
formatter.refresh();

input.value = "1234567.89";
formatter.refresh();
```

Native form resets update the preview after the browser restores the field. Input events remain native and bubble normally.

## Integration changes

This replaces formatting inside the editable field with a separate preview. Consumers that relied on commas appearing in `input.value` must use `getFormattedValue()` for display. Submitted form values remain the text the user entered.

`allowNegative`, `integerScale`, and `decimalScale` now report validation errors instead of blocking keys or discarding characters. Invalid numbers return `NaN` from `getFloatValue()` instead of silently becoming zero or a partial number.

`debounceTime`, `maxUndoStackSize`, and `allowDecimalReplacement` no longer apply. Native editing owns undo and decimal entry.

## Accessibility and testing

Host pages must provide a visible label, instructions, focus styling, and accessible validation. Use a text input when negative values are allowed. Some mobile decimal keyboards omit a minus key.

The browser suite covers native editing, undo and redo, bulk text insertion, composition, form reset, teardown, and both source and minified builds. Demo checks cover axe findings, keyboard focus, validation, accessibility tree values, text enlargement, narrow layouts, and forced colors where emulation is supported.

Orca 50.3 speech output was checked with Chromium and Firefox on Linux, including native keyboard input and tab navigation. The demo announced field labels, instructions, validation errors, and success messages. Typing did not repeatedly announce the changing preview. Native clipboard paste, cut, and undo were also checked in Chromium.

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm test
```

```sh
npm run build
```

The build regenerates the demo bundle and its content hash in the import URL.

Automated checks cannot certify universal accessibility. NVDA, JAWS, VoiceOver, TalkBack, actual dictation, and mobile assistive technology still need testing in the host application. Passing browser tests does not claim those combinations were tested.

## Attribution

Grouping expressions are adapted from [cleave-zen](https://github.com/nosir/cleave-zen), under the MIT license.
