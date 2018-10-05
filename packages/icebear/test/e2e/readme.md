# End to end testing

## What is it?

End-to-end testing is a methodology used to test whether the flow of an application is performing as designed from start to finish. [1]

## Why is it useful?

End-to-end testing can:
- find bugs that unit tests can't (e.g: wiring bugs, environment bugs)
- ensure that the software, as a whole, is feature complete
- simulate how a real user behaves and uses the app

## What are the drawbacks?

As E2E tests touch more code than other types of tests, the point of failure of a test can be tricky to pin down.

The Testing Pyramind [2] recommends having a few E2E tests, a bit more integration tests and the bulk of them as unit tests.

## How to write a good end to end test

The purpose of carrying out end-to-end tests is to identify system dependencies and to ensure that the right information is passed between various system components and systems. [1]

Do not test individual units, test instead <i>actual flow through a system</i> (examples of how someone can use the app). Try to mimick end user behavior and their workflow.

Examples: signup with email, login with username and password, add item to cart and checkout, upload file to actual storage, etc.

## Tooling

Cucumber is a tool for running automated tests written in plain language. [3]

Pros:
- test cases are written in plain language (as a user story)
- improves communication and collaboration
- once the test definition (user story) is written, the test implementation can be added later
- can see "test coverage" by how many unimplemented tests there are
- use Javascript and standard / pre-existing tools to implement tests

Cons:
- Cucumber DSL (see term definitions below)

## Adding a new test

For a new feature, add a new feature folder with 2 inner folders, <i>stories</i> and <i>supportCode</i> (or copy-paste <i>sample</i> project and modify it).

Project structure:
```
feature1
 |__ stories
 |__ supportCode
feature2
 |__ stories
 |__ supportCode

```

Inside the <i>stories</i> folder, add a .feature file and add the user story in plain language.

Example: myFeature.feature file
```
Feature: Addition
    Scenario: Computing positive numbers sum
        Given the first number is 1
        When I add 2 to it
        Then the result should be 3
```

Now add the code implementation in the <i>supportCode</i> folder. Note that running the tests will find find any missing implementation and suggest snippets which you can paste in your implementation file.

Example: myImplementation.js
```
const { Given, Then, When } = require('cucumber');
const expect = require('chai').expect;

    let answer = 0;

    Given('the first number is {int}', (input) => {
        answer = input;
    });

    When('I add {int} to it', (input) => {
        answer = answer + input;
    });

    Then('the result should be {int}', (input) => {
        expect(answer).to.equal(input);
    });

```

## Terms and definitions

<b>Feature</b>: name and description of the user story

<b>Scenario</b>: Example of how the feature is useful

<b>Given</b>: Context in which an action will happen (I am logged in, I am in the checkout page, etc)

<b>When</b>: Execute an action to achieve the desired result (I press the log out button, I tap the "Purchase" button, etc)

<b>Then</b>: Verify that the test outcome matches expectations (I see the registration page, I see a purchase receipt, etc)

## Links

[1] see https://stackoverflow.com/tags/e2e-testing/info

[2] see https://2.bp.blogspot.com/-YTzv_O4TnkA/VTgexlumP1I/AAAAAAAAAJ8/57-rnwyvP6g/s1600/image02.png

[3] see https://github.com/cucumber/cucumber-js