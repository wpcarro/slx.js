function select(query, xs, config) {
    const predicate = compile(parse(query, config), config);
    return xs.filter(predicate);
}

function compile(ast, config) {
    if (ast.type === 'CONJUNCTION') {
        const lhs = compile(ast.lhs, compile);
        const rhs = compile(ast.rhs, compile);

        if (ast.joint === 'AND') {
            return function(x) {
                return lhs(x) && rhs(x);
            };
        }
        if (ast.joint === 'OR') {
            return function(x) {
                return lhs(x) || rhs(x);
            };
        }
    }
    if (ast.type === 'DATE_SELECTION') {
        if (ast.key === 'before') {
            return function(row) {
                let t = new Date();
                if (ast.val === 'yesterday') {
                    t.setDate(t.getDate() - 1);
                    console.log(t);
                }
                // MM/DD/YYYY
                else {
                    t = new Date(ast.val);
                }
                return row[config.dateKey] < t;
            };
        }
        if (ast.key === 'after') {
            return function(row) {
                let t = new Date();
                if (ast.val === 'yesterday') {
                    t.setDate(t.getDate() - 1);
                    console.log(t);
                }
                // MM/DD/YYYY
                else {
                    t = new Date(ast.val);
                }
                return row[config.dateKey] > t;
            };
        }
    }
    if (ast.type === 'COMPARE_SELECTION') {
        const f = compile(ast.val, config);

        let compare = null;
        if (ast.operator === 'LT') { compare = (x, y) => x < y; }
        if (ast.operator === 'GT') { compare = (x, y) => x > y; }
        if (ast.operator === 'LTE') { compare = (x, y) => x <= y; }
        if (ast.operator === 'GTE') { compare = (x, y) => x >= y; }

        return function(row) {
            return ast.negate ? !compare(row[ast.key], ast.val) : compare(row[ast.key], ast.val);
        };
    }
    if (ast.type === 'SELECTION') {
        const f = compile(ast.val, config);
        return function(row) {
            return ast.negate ? !f(row[ast.key]) : f(row[ast.key]);
        };
    }
    if (ast.type === 'MATCH_ALL') {
        if (ast.matchType === 'STRING') {
            return function(row) {
                return Object.values(row).some(x => {
                    if (config.caseSensitive) {
                        return x === ast.val;
                    } else {
                        return x.toLowerCase() === ast.val.toLowerCase();
                    }
                })
            };
        }
        if (ast.matchType === 'REGEX') {
            return function(row) {
                return Object.values(row).some(x => ast.val.test(x));
            };
        }
    }
    if (ast.type === 'STRING') {
        return function(x) {
            if (config.caseSensitive) {
                return x === ast.val;
            } else {
                return x.toLowerCase() === ast.val.toLowerCase();
            }
        };
    }
    if (ast.type === 'REGEX') {
        return function(x) {
            return ast.val.test(x);
        };
    }
}

// A "selection" without a "$column:" prefix should fuzzy-search all columns.
//
// conjunction -> selection ( ( "AND" | "OR" )? selection )* ;
// selection   -> "-"? COLUMN ":" ( regex | string ) | regex ;
// regex       -> [_-a-zA-Z0-9] | "/" [ _-a-zA-Z0-9] "/" | string ;
// string      -> "\"" [ _-a-zA-Z0-9] "\"" ;

// Whatever characters are valid for a JS regex.
const ATOM_REGEX = /[-_.\[\]a-zA-Z0-9*+^$]/;

function tokenize(x) {
    const result = [];
    let i = 0;
    while (i < x.length) {
        if (x[i] === ' ') {
            i += 1;
            while (i < x.length && x[i] === ' ') {
                i += 1;
            }
            result.push(['WHITESPACE', null]);
            continue;
        }
        if (x[i] === '-') {
            result.push(['NEGATE', null]);
            i += 1;
            continue;
        }
        // Tokenize numbers (i.e. integers, floats).
        if (/[0-9]/.test(x[i])) {
            let curr = x[i];
            i += 1;
            while (i < x.length && /[0-9]/.test(x[i])) {
                curr += x[i];
                i += 1;
            }
            result.push(['NUMBER', parseFloat(curr)]);
            continue;
        }
        if (ATOM_REGEX.test(x[i])) {
            let curr = x[i];
            i += 1;
            while (i < x.length && ATOM_REGEX.test(x[i])) {
                curr += x[i];
                i += 1;
            }
            result.push(['ATOM', curr]);
            continue;
        }
        if (x[i] === '<' && i + 1 < x.length && x[i + 1] === '=') {
            result.push(['COMPARE', 'LTE']);
            i += 1;
            continue;
        }
        if (x[i] === '<') {
            result.push(['COMPARE', 'LT']);
            i += 1;
            continue;
        }
        if (x[i] === '>' && i + i < x.length && x[i + 1] === '=') {
            result.push(['COMPARE', 'GTE']);
            i += 1;
            continue;
        }
        if (x[i] === '>') {
            result.push(['COMPARE', 'GT']);
            i += 1;
            continue;
        }
        if (x[i] === ':') {
            result.push(['COLON', null]);
            i += 1;
            continue;
        }
        if (x[i] === '(') {
            result.push(['LPAREN', null]);
            i += 1;
            continue;
        }
        if (x[i] === ')') {
            result.push(['RPAREN', null]);
            i += 1;
            continue;
        }
        if (x[i] === '/') {
            let start = i;
            let curr = '';
            i += 1;
            while (i < x.length && x[i] !== '/') {
                curr += x[i];
                i += 1;
            }
            // error
            if (i >= x.length) {
                throw `Tokenize Error: EOL while attempting to tokenize the regex beginning at column: ${start}`;
            }
            if (x[i] === '/') {
                result.push(['REGEX', curr]);
                i += 1;
            }
            continue;
        }
        if (x[i] === '"') {
            let start = i;
            let curr = '';
            i += 1;
            while (i < x.length && x[i] !== '"') {
                // continue on \"
                if (x[i] === '\\' && x[i + 1] === '"') {
                    curr += '\"';
                    i += 2;
                } else {
                    curr += x[i];
                    i += 1;
                }
            }
            if (i >= x.length) {
                throw `Tokenize Error: EOL while attempting to tokenize the string starting at column: ${start}`;
            }
            if (x[i] === '"') {
                result.push(['STRING', curr]);
                i += 1;
            }
            continue;
        }
        else {
            i += 1;
        }
    }
    return result;
}

function expect(f, expectation, p) {
    const [type, val] = p.tokens[p.i];
    if (f(type, val)) {
        p.i += 1;
    } else {
        throw `Parse Error: expected ${expectation}, but got ${p.tokens[p.i]}; ${JSON.stringify(p)}`
    }
}

function matches(f, p) {
    const [type, val] = p.tokens[p.i];
    if (f(type, val)) {
        return true;
    }
    return false;
}

function match(f, expectation, p) {
    const [type, val] = p.tokens[p.i];
    if (f(type, val)) {
        p.i += 1;
        return val;
    }
    throw `Parse Error: expected ${expectation}, but got: ${p.tokens[p.i]}; ${JSON.stringify(p)}`;
}

function skipWhitespace(p) {
    while (p.i < p.tokens.length && matches((type, _) => type === 'WHITESPACE', p)) {
        p.i += 1;
    }
}

function parser(tokens) {
    return { i: 0, tokens };
}

function parse(x, config) {
    const tokens = tokenize(x);
    const p = parser(tokens);
    return conjunction(p, config);
}

function conjunction(p, config) {
    skipWhitespace(p);

    const lhs = selection(p, config);
    skipWhitespace(p);

    if (p.i >= p.tokens.length) {
        return lhs;
    }

    let joint = 'AND';
    if (matches((type, val) => type === 'ATOM' && val === 'AND', p)) {
        joint = 'AND';
        p.i += 1;
    } else if (matches((type, val) => type === 'ATOM' && val === 'OR', p)) {
        joint = 'OR';
        p.i += 1;
    }
    skipWhitespace(p);
    let rhs = conjunction(p, config);

    return {
        type: 'CONJUNCTION',
        joint,
        lhs,
        rhs,
    };
}

function peekType(n, p) {
    if (p.i + n < p.tokens.length) {
        return p.tokens[p.i + n][0];
    }
    return null;
}

function selection(p, config) {
    // column:value OR -column:value
    if ((peekType(0, p) === 'ATOM' && peekType(1, p) === 'COLON') ||
        (peekType(0, p) === 'NEGATE' && peekType(1, p) === 'ATOM' && peekType(2, p) === 'COLON')) {

        let negate = false;
        if (p.tokens[p.i][0] === 'NEGATE') {
            negate = true;
            p.i += 1;
        }

        const key = match((type, _) => type === 'ATOM', 'a column label', p);
        expect((type, val) => type === 'COLON', 'a colon', p);

        if (key === 'before' || key === 'after') {
            const val = date(p);
            return {
                type: 'DATE_SELECTION',
                key,
                val,
            };
        } else {
            const val = value(p, config);
            return {
                type: 'SELECTION',
                negate,
                key,
                val,
            };
        }
    }
    // column<value OR -column<value
    else if ((peekType(0, p) === 'ATOM' && peekType(1, p) === 'COMPARE') ||
             (peekType(0, p) === 'NEGATE' && peekType(1, p) === 'ATOM' && peekType(2, p) === 'COMPARE')) {
        let negate = false;
        if (p.tokens[p.i][0] === 'NEGATE') {
            negate = true;
            p.i += 1;
        }

        const key = match((type, _) => type === 'ATOM', 'a column label', p);
        const operator = match((type, _) => type === 'COMPARE', 'a comparison operator (i.e. "<", ">", "<=", ">=")', p);
        const val = match((type, _) => type === 'NUMBER', 'a number', p);

        return {
            type: 'COMPARE_SELECTION',
            operator,
            negate,
            key,
            val,
        };
    }
    else {
        return matchAll(p, config);
    }
}

function matchAll(p, config) {
    const [type, val] = p.tokens[p.i];

    // Cast atoms into strings or regexes depending on the current config.
    if (type === 'ATOM') {
        p.i += 1;
        if (config.preferRegex) {
            const regex = config.caseSensitive ? new RegExp(val) : new RegExp(val, "i");
            return { type: 'MATCH_ALL', matchType: 'REGEX', val: regex };
        } else {
            return { type: 'MATCH_ALL', matchType: 'STRING', val }
        }
    }
    if (type === 'STRING') {
        p.i += 1;
        return { type: 'MATCH_ALL', matchType: 'STRING', val };
    }
    if (type === 'REGEX') {
        p.i += 1;
        const regex = config.caseSensitive ? new RegExp(val) : new RegExp(val, "i");
        return { type: 'MATCH_ALL', matchType: 'REGEX', val: regex };
    }
    throw `Parse Error: Expected a regular expression or a string, but got: ${p.tokens[p.i]}; ${JSON.stringify(p)}`;
}

function value(p, config) {
    const [type, val] = p.tokens[p.i];

    // Cast atoms into strings or regexes depending on the current config.
    if (type === 'ATOM') {
        p.i += 1;
        if (config.preferRegex) {
            const regex = config.caseSensitive ? new RegExp(val) : new RegExp(val, "i");
            return { type: 'REGEX', val: regex };
        } else {
            return { type: 'STRING', val }
        }
    }
    if (type === 'STRING') {
        p.i += 1;
        return { type, val };
    }
    if (type === 'REGEX') {
        p.i += 1;
        const regex = config.caseSensitive ? new RegExp(val) : new RegExp(val, "i");
        return { type, val: regex };
    }
    throw `Parse Error: Expected a regular expression or a string, but got: ${p.tokens[p.i]}; ${JSON.stringify(p)}`;
}

function date(p) {
    const [type, val] = p.tokens[p.i];
    p.i += 1;

    return val;
}
