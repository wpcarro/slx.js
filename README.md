# slx.js

Filter tabular data in the browser using an ergonomic query language.

## Status

This project is usable today (I use it in my projects), but it's currently alpha
status. See the wish list for remaining features.

## Installation

`slx.js` is available via CDN:

```shell
<script src="https://cdn.jsdelivr.net/gh/wpcarro/slx.js/index.js" async></script>
```

## Usage

`slx.js` hasn't been properly benchmarked, but in my personal projects, it works
fine with `O(1,000)s` of records.

```javascript
const cast = [
  { first: "Graham", last: "Chapman" },
  { first: "John", last: "Cleese" },
  { first: "Terry", last: "Gilliam" },
  { first: "Eric", last: "Idle" },
  { first: "Terry", last: "Jones" },
  { first: "Michael", last: "Palin" },
];

const config = {
    // Match values case sensitively when filtering.
    caseSensitive: false,
    // Coerce values into regular expressions (instead of strings) when they're defined as atoms.
    preferRegex: true,
    // The key in the JS object that hosts the Date type against which we filter.
    dateKey: 'Date',
};

console.log(select('last:^C.+$', cast, config));
// [{ first: "Graham", last: "Chapman" }, { first: "John", last: "Cleese" }]
```

## Wish List

- Support explicit grouping with parentheses (e.g. `title:once (director:Tarantino OR director:Coen)`).
- Proper benchmarking (see "Usage" section).
- Something something documentation.
- Something something testing.

## See also:

- [`slx`](https://github.com/wpcarro/slx)
