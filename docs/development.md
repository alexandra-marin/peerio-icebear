# Development

## Getting started

- install nodejs and npm
- clone repository
- run `npm install`

To make sure everything works correctly, run `npm test`.
If you have some time (15-20 min) you can run `npm run test:e2e` to perform integration tests.

## Development policy

### Errors

#### Always use `Error` object when:   
throwing an exception

```
throw new Error()
```
rejecting a Promise
```
reject(new Error())
```
or returning an error value
```
return new Error()
```

#### Use `instanceof` to detect error type
```
catch(ex){
  if(ex instanceof MyCustomError){
   // do smth.
  }
}
```

#### Create custom errors and wrap any other caught ones
Create custom errors only when you need to handle this error type specifically.
Otherwise just use `new Error('message')` 
```
function CustomError(message, nestedError, otherData) {
  var error = Error.call(this, message);
  this.name = 'CustomError';
  this.message = error.message;
  this.stack = error.stack;
  this.nestedError = nestedError;
  this.otherData = otherData;
}

CustomError.prototype = Object.create(Error.prototype);
CustomError.prototype.constructor = CustomError;

```

#### Create fail-safe api

- If it makes sense in the global application flow - make api call retry/repeat itself in case of failure.
For this purpose use `helpers/retry.js`.
- Some of api calls are expected to return promise rejection or falsy return value in case of failure so that user may
decide if they want to repeat an action.


## Testing

## Unit tests 

Simple and well decoupled code is covered with unit tests, you can find them in `/test/unit` folder, and run with `npm run test:unit`

## e2e tests

Peerio Icebear mainly relies on integration (e2e) tests written using cucumber.
To run all e2e tests execute `npm run test:e2e`.

### WIP tests

When you are working on some prticular test scenarios or features, you can mark them with `@wip` tag, which will make 2 things happen.
1. These features/scenarios will not run on CI
2. Locally you can run `npm run test:e2e:wip` to only run tagged scenarios.

Don't forget to remove the @wip tag when the work is done!

### Debugging

There's another tag helping to debug scenarios in chrome dev tools - `@debug`.
Just mark your scenarios with the tag and run `npm run test:e2e:debug`.
Then go to `chrome://inspect` in Chrome browser to open the devtools for your test scenarios.
