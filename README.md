# liveNumberFormat.js

A tiny Javascript library that gives live as-you-type formatting to numbers & currencies, ~1600 bytes minified + gzipped.


![output](https://github.com/abhinavxd/liveNumberFormat.js/assets/48166553/161e1ffc-a25a-468f-908d-a5991bad40cf)


Check the [demo source](https://github.com/abhinavxd/liveNumberFormat.js/blob/main/docs/index.html).


## Optional config

Default values shown below.

```javascript
new LiveNumberFormat(input,
{
        // Options for formatStyle
        // 1. thousandLakhCrore
        // 2. thousand
        // 3. tenThousand
        formatStyle: "thousand",

        stripLeadingZeroes: false,

        allowNegative: true,

        // Max integers allowed.
        // defaults to Infinity
        integerScale: 20,

        // Max decimals allowed.
        // defaults to Infinity
        decimalScale: 7
});
```
