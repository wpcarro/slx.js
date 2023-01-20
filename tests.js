import { createRoot } from "react-dom/client";
import React from "react";


const john = { first: 'John', last: 'Cleese', age: 83, birthday: new Date("10/27/1939") };
const graham = { first: 'Graham', last: 'Chapman', age: 48, birthday: new Date("01/08/1941") };

const xs = [
    john,
    graham,
];
const cfg = {
    caseSensitive: false,
    preferRegex: true,
    dateKey: 'birthday',
};
const tests = [
    ['support EQ', 'age=83', xs, cfg, [john]],
    ['supports LT', 'age<83', xs, cfg, [graham]],
    ['supports LTE', 'age<=83', xs, cfg, [john, graham]],
    ['supports GT', 'age>48', xs, cfg, [john]],
    ['supports GTE', 'age>=48', xs, cfg, [john, graham]],
    ['supports grouping (1)', 'last:/^C/ (age=83 OR age=48)', xs, cfg, [john, graham]],
    ['supports grouping (2)', '(age=83)', xs, cfg, [john]],
    ['supports grouping (3)', '(age=83 OR age=48)', xs, cfg, [john, graham]],
];

function equal(xs, ys) {
    return xs.length === ys.length && xs.every((x, i) => x === ys[i]);
}

class App extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return (
            <table>
              <thead>
                <th>pass/fail</th>
                <th>Label</th>
                <th>code</th>
                <th>actual</th>
                <th>expected</th>
              </thead>
              <tbody>
                {this.props.tests.map(test => {
                    const [label, query, xs, cfg, expected] = test;
                    const actual = select(query, xs, cfg);
                    return (
                        <tr style={{backgroundColor: equal(actual, expected) ? null : 'red'}}>
                          <td>{equal(actual, expected) ? "pass" : "fail"}</td>
                          <td>{label}</td>
                          <td>select("{query}", {JSON.stringify(xs)}, {JSON.stringify(cfg)})</td>
                          <td>{JSON.stringify(actual)}</td>
                          <td>{JSON.stringify(expected)}</td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
        );
    }
}

const container = document.getElementById("mount");
const root = createRoot(container);
root.render(<App tests={tests} />);
