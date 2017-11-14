## Contribution guide

### Pull request

#### One pull request == one feature/bugfix/refactor.
It's easier to review and gives more choices in terms of merging something while waiting on something else.

#### Document breaking changes

Breaking changes should be described 
1. In the pull request template
2. in your commit message in exactly this format:
```
type: message

BREAKING CHANGE:
Description of the things that have changed.
```
This way library major version will get bumped.
If you forgot to add breaking change information to your commits, ask repository owner to include it into squashed commit message when merging.

#### Add manual testing instructions
List views and functionality to test, cases, and possible regressions.

#### Add several reviewers to your PR including tester


### Code
  
#### Add jsdoc summaries and add typescript typings.
One can't overestimate the value of good descriptions and typings.</dd>
  
#### Comment your logic.

The more the merrier, of course nobody wants to see something like
```
// message count constant
const messageCount;
```
just think *"what if younger, less experienced myself tries to read this code, how can I help to understand my decisions"* or *"could someone try and refactor this? But it would be a mistake because ... so I better warn them."* 
 
#### Write readable code.
Break down complex expressions and long functions. Give meaningful and short names to your variables and functions.
If you can't follow code execution it in your mind - something is likely wrong.

#### Refactor responsibly
If you want to refactor something that touches more then just your changes - consider making a separate PR for refactored code.

#### Maintain coding style and patterns
If you add 'one more' of something that already exists (for example another settings parameter, or another method to a Message class) look for established pattern of how similar things are done/organized and do it the same way. Or, if you have a good reason to change the pattern - refactor it everywhere so the code remains uniform.  
 
#### Write unit tests for simple modules without internal dependencies.
If you can unit test it without mocks/stubs - do it.

#### Write e2e tests.
Cucumber ftw. Lots of useful info [in this doc](https://github.com/PeerioTechnologies/peerio-icebear/tree/dev/test/e2e).

#### Think about performance.
No need to go over the top, but try to figure which parts of your code are likely to get executed a lot and make them performant.
