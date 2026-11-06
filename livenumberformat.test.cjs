const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function fixture(page, source, options = {}, value = "") {
    await page.route("**/fixture", route => route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="en"><title>Number editing</title><main><form><label for="native">Native</label><input id="native"><label for="number">Number</label><p id="hint">Enter a number.</p><input id="number" aria-describedby="hint"><span id="preview"></span><button type="reset">Reset</button></form></main></html>',
    }));
    await page.goto("/fixture");
    await page.evaluate(async ({ source, options, value }) => {
        window.LiveNumberFormat = (await import(source)).default;
        const input = document.getElementById("number");
        input.defaultValue = value;
        document.getElementById("native").defaultValue = value;
        window.formatter = new window.LiveNumberFormat(input, {
            ...options, output: document.getElementById("preview"),
        });
    }, { source, options, value });
}

async function select(page, id, start, end = start) {
    await page.locator(id).evaluate((el, range) => {
        el.focus();
        el.setSelectionRange(...range);
    }, [start, end]);
}

async function state(page, id) {
    return page.locator(id).evaluate(el => ({ value: el.value, start: el.selectionStart, end: el.selectionEnd }));
}

for (const source of ["/livenumberformat.js", "/docs/livenumberformat.min.js"]) {
    test.describe(source, () => {
        test("formats every grouping style without altering the input", async ({ page }) => {
            await fixture(page, source);
            const input = page.locator("#number");
            await input.fill("123456789.0123");
            for (const [style, expected] of [
                ["thousand", "123,456,789.0123"],
                ["thousandLakhCrore", "12,34,56,789.0123"],
                ["tenThousand", "1,2345,6789.0123"],
            ]) {
                await page.evaluate(style => { window.formatter.formatStyle = style; window.formatter.refresh(); }, style);
                await expect(page.locator("#preview")).toHaveText(`Formatted number: ${expected}`);
                await expect(input).toHaveValue("123456789.0123");
            }
        });

        for (const [key, start, end] of [
            ["Control+ArrowRight", 1, 1], ["Alt+ArrowRight", 1, 1],
            ["ArrowRight", 1, 4], ["ArrowLeft", 3, 5], ["Delete", 1, 4],
            ["Backspace", 1, 4], ["Shift+ArrowRight", 1, 1],
            ["Home", 3, 3], ["End", 1, 1],
        ]) {
            test(`matches native ${key} at selection ${start}:${end}`, async ({ page }) => {
                await fixture(page, source, {}, "1,234");
                await select(page, "#native", start, end);
                await page.keyboard.press(key);
                const native = await state(page, "#native");
                await select(page, "#number", start, end);
                await page.keyboard.press(key);
                expect(await state(page, "#number")).toEqual(native);
            });
        }

        test("preserves immediate native undo and redo", async ({ page }) => {
            await fixture(page, source);
            const states = {};
            for (const id of ["#native", "#number"]) {
                await page.locator(id).focus();
                await page.keyboard.type("1234");
                await page.keyboard.press("Control+z");
                const undo = await state(page, id);
                await page.keyboard.press("Control+Shift+Z");
                states[id] = { undo, redo: await state(page, id) };
            }
            expect(states["#number"]).toEqual(states["#native"]);
            expect(states["#number"].undo.value).toBe("");
            expect(states["#number"].redo.value).toBe("1234");
            await expect(page.locator("#preview")).toHaveText("Formatted number: 1,234");
        });

        test("preserves browser edit commands and updates the preview", async ({ page }) => {
            await fixture(page, source);
            await page.locator("#number").focus();
            await page.keyboard.type("1234");
            await page.evaluate(() => document.execCommand("undo"));
            await expect(page.locator("#number")).toHaveValue("");
            await expect(page.locator("#preview")).toBeEmpty();
            await page.evaluate(() => document.execCommand("redo"));
            await expect(page.locator("#number")).toHaveValue("1234");
            await expect(page.locator("#preview")).toHaveText("Formatted number: 1,234");
        });

        test("preserves bulk insertion, replacements, and native input events", async ({ page }) => {
            await fixture(page, source);
            await page.evaluate(() => {
                window.inputEvents = { native: [], number: [] };
                for (const id of ["native", "number"]) {
                    document.getElementById(id).addEventListener("input", event => {
                        window.inputEvents[id].push({ value: event.target.value, type: event.inputType });
                    });
                }
            });
            for (const id of ["#native", "#number"]) {
                await page.locator(id).focus();
                await page.keyboard.insertText("12345.678");
                await select(page, id, 0, 5);
                await page.keyboard.insertText("99");
            }
            await expect(page.locator("#number")).toHaveValue("99.678");
            const events = await page.evaluate(() => window.inputEvents);
            expect(events.number).toEqual(events.native);
            expect(events.number.map(event => event.value)).toEqual(["12345.678", "99.678"]);
        });

        test("never truncates digits or validates during typing", async ({ page }) => {
            await fixture(page, source, { integerScale: 3, decimalScale: 2, allowNegative: false });
            for (const [value, code] of [
                ["12345.678", "integerScale"], ["123.678", "decimalScale"],
                ["-12", "negativeNotAllowed"], ["-", "invalidNumber"], [".", "invalidNumber"],
                ["12..3", "invalidNumber"], ["1,,234", "invalidNumber"], ["12abc", "invalidNumber"],
                ["12,34", "invalidNumber"], ["0000", "integerScale"], ["0", null], ["", null],
            ]) {
                await page.locator("#number").fill(value);
                await expect(page.locator("#number")).toHaveValue(value);
                await expect(page.locator("#number")).not.toHaveAttribute("aria-invalid");
                expect(await page.evaluate(() => window.formatter.getValidationError())).toBe(code);
                if (code) {
                    expect(await page.evaluate(() => Number.isNaN(window.formatter.getFloatValue()))).toBe(true);
                }
            }
        });

        test("normalizes supported number forms only in the preview", async ({ page }) => {
            await fixture(page, source, { stripLeadingZeroes: true, integerScale: 8 });
            for (const [value, formatted, numeric] of [
                ["１２３４．５", "1,234.5", 1234.5], ["−1234.5", "-1,234.5", -1234.5],
                ["0001234.50", "1,234.50", 1234.5], ["-12345678", "-12,345,678", -12345678],
                ["1,23,456", "123,456", 123456], ["1,2345,6789", "123,456,789", NaN],
                [".5", ".5", 0.5], ["-0", "-0", -0],
            ]) {
                await page.locator("#number").fill(value);
                await expect(page.locator("#number")).toHaveValue(value);
                expect(await page.evaluate(() => window.formatter.getFormattedValue())).toBe(formatted);
                expect(await page.evaluate(() => window.formatter.getFloatValue())).toBe(numeric);
            }
        });

        test("defers the preview until composition finishes", async ({ page }) => {
            await fixture(page, source, {}, "12");
            const result = await page.locator("#number").evaluate(el => {
                el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
                el.value = "１２３４";
                el.setSelectionRange(1, 3);
                el.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, inputType: "insertCompositionText" }));
                const during = { value: el.value, start: el.selectionStart, end: el.selectionEnd, preview: window.formatter.output.textContent };
                el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
                return { during, after: window.formatter.output.textContent };
            });
            expect(result).toEqual({
                during: { value: "１２３４", start: 1, end: 3, preview: "Formatted number: 12" },
                after: "Formatted number: 1,234",
            });
        });

        test("preserves browser composition with no early rewriting", async ({ page, browserName }) => {
            test.skip(browserName !== "chromium", "Browser composition protocol is specific to Chromium.");
            await fixture(page, source);
            await page.locator("#number").focus();
            const session = await page.context().newCDPSession(page);
            await session.send("Input.imeSetComposition", { text: "１２３４", selectionStart: 4, selectionEnd: 4 });
            await expect(page.locator("#number")).toHaveValue("１２３４");
            await expect(page.locator("#preview")).toBeEmpty();
            await session.send("Input.insertText", { text: "１２３４" });
            await expect(page.locator("#number")).toHaveValue("１２３４");
            await expect(page.locator("#preview")).toHaveText("Formatted number: 1,234");
        });

        test("restores preview after form reset and preserves reset cancellation", async ({ page }) => {
            await fixture(page, source, {}, "1234");
            await page.locator("#number").fill("5678");
            await page.getByRole("button", { name: "Reset" }).click();
            await expect(page.locator("#number")).toHaveValue("1234");
            await expect(page.locator("#preview")).toHaveText("Formatted number: 1,234");
            await page.evaluate(() => document.querySelector("form").addEventListener("reset", event => event.preventDefault()));
            await page.locator("#number").fill("5678");
            await page.getByRole("button", { name: "Reset" }).click();
            await expect(page.locator("#preview")).toHaveText("Formatted number: 5,678");
        });

        test("preserves focus, selections, descriptions, and supplied output on teardown", async ({ page }) => {
            await fixture(page, source, {}, "1234");
            await expect(page.locator("#number")).toHaveAttribute("aria-describedby", "hint");
            await expect(page.locator("#preview")).toHaveAttribute("aria-live", "off");
            await select(page, "#number", 1, 3);
            await page.evaluate(() => {
                window.formatter.formatStyle = "tenThousand";
                window.formatter.refresh();
                document.getElementById("number").setAttribute("aria-describedby", "hint error");
                window.formatter.destroy();
            });
            expect(await state(page, "#number")).toEqual({ value: "1234", start: 1, end: 3 });
            await expect(page.locator("#number")).toBeFocused();
            await expect(page.locator("#number")).toHaveAttribute("aria-describedby", "hint error");
            await expect(page.locator("#preview")).toBeEmpty();
            await expect(page.locator("#preview")).not.toHaveAttribute("aria-live");
            await page.locator("#number").fill("5678");
            await expect(page.locator("#preview")).toBeEmpty();
        });

        test("creates independent previews and removes only its own elements", async ({ page }) => {
            await fixture(page, source);
            const result = await page.evaluate(() => {
                window.formatter.destroy();
                const first = new window.LiveNumberFormat(document.getElementById("number"));
                const second = new window.LiveNumberFormat(document.getElementById("native"));
                first.destroy();
                return { separate: first.output !== second.output, firstRemoved: !first.output.isConnected, secondPresent: second.output.isConnected, descriptions: document.getElementById("number").getAttribute("aria-describedby") };
            });
            expect(result).toEqual({ separate: true, firstRemoved: true, secondPresent: true, descriptions: "hint" });
        });
    });
}

test.describe("demo accessibility", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/docs/index.html");
        await expect(page.locator("#formattedNumber")).toHaveAttribute("aria-live", "off");
    });

    test("passes axe in empty, populated, and error states", async ({ page }) => {
        for (const value of [null, "1234567.89", "12abc"]) {
            if (value !== null) {
                await page.getByLabel("Number", { exact: true }).fill(value);
                await page.getByRole("button", { name: "Check number" }).click();
            }
            const results = await new AxeBuilder({ page }).analyze();
            expect(results.violations).toEqual([]);
        }
    });

    test("has labels, visible keyboard focus, and predictable tab order", async ({ page }) => {
        await page.keyboard.press("Tab");
        const input = page.getByLabel("Number", { exact: true });
        await expect(input).toBeFocused();
        expect(await input.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
        await page.keyboard.type("1234567");
        await page.keyboard.press("Tab");
        await expect(page.getByLabel("Number format")).toBeFocused();
        await page.getByLabel("Number format").selectOption("thousandLakhCrore");
        await expect(page.getByLabel("Number format")).toBeFocused();
        await expect(input).toHaveValue("1234567");
        await expect(page.locator("#formattedNumber")).toHaveText("Formatted number: 12,34,567");
        await page.keyboard.press("Tab");
        await expect(page.getByRole("button", { name: "Check number" })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(page.getByRole("link")).toBeFocused();
    });

    test("only displays validation after submitting and announces the result", async ({ page }) => {
        const input = page.getByLabel("Number", { exact: true });
        await input.fill("123456789012345678901");
        await expect(page.locator("#numberError")).toBeEmpty();
        await expect(input).not.toHaveAttribute("aria-invalid");
        await page.getByRole("button", { name: "Check number" }).click();
        await expect(input).toBeFocused();
        await expect(input).toHaveAttribute("aria-invalid", "true");
        await expect(input).toHaveAttribute("aria-describedby", "numberHelp numberError");
        await expect(page.getByRole("alert")).toContainText("at most 20 digits");
        await input.fill("1234.50");
        await expect(page.getByRole("alert")).toBeEmpty();
        await expect(input).toHaveAttribute("aria-invalid", "false");
        await page.keyboard.press("Enter");
        await expect(page.locator("#result")).toHaveText("Number accepted: 1,234.50.");
        await expect(page.locator("#result")).toHaveAttribute("aria-live", "polite");
        await input.fill("-");
        await expect(page.getByRole("alert")).toBeEmpty();
        await expect(input).not.toHaveAttribute("aria-invalid", "true");
        await expect(page.locator("#result")).toBeEmpty();
    });

    test("reflows at 320 pixels with enlarged and spaced text", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 800 });
        await page.getByLabel("Number", { exact: true }).fill("12345678901234567890.1234567");
        for (const css of ["", "html { font-size: 40px } * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important } p { margin-bottom: 2em !important }"]) {
            if (css) {
                await page.addStyleTag({ content: css });
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
            await expect(page.getByRole("button", { name: "Check number" })).toBeVisible();
        }
    });

    test("keeps focus and borders visible in forced colors", async ({ page, browserName }) => {
        test.skip(browserName === "webkit", "WebKit does not emulate forced colors.");
        await page.emulateMedia({ forcedColors: "active" });
        await page.keyboard.press("Tab");
        const css = await page.locator("#numberInput").evaluate(el => {
            const style = getComputedStyle(el);
            return { outline: style.outlineStyle, width: style.outlineWidth, border: style.borderStyle };
        });
        expect(css).toEqual({ outline: "solid", width: "3px", border: "solid" });
    });

    test("exposes the value and preview without changing the input description", async ({ page, browserName }) => {
        test.skip(browserName !== "chromium", "Accessibility tree protocol is specific to Chromium.");
        await page.getByLabel("Number", { exact: true }).fill("1234.50");
        const session = await page.context().newCDPSession(page);
        const { nodes } = await session.send("Accessibility.getFullAXTree");
        const input = nodes.find(node => node.role?.value === "textbox");
        expect(input.name.value).toBe("Number");
        expect(input.value.value).toBe("1234.50");
        expect(input.description.value).not.toContain("Formatted number");
        expect(input.description.value).toContain("Use a period for decimals");
        expect(nodes.some(node => node.name?.value === "Formatted number: 1,234.50")).toBe(true);
    });
});
