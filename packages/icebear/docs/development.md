# Development

## Development configuration

To get started, set the `PEERIO_STAGING_SOCKET_SERVER` environment variable. Run `npm install` and `npm start` to run Karma. 

In order to log in automatically, Good news, create 'autologin.json' in project root (gitignored) with your desired user: `{ "username":"", "passphrase":""}`

## Development policy

### Dependencies

When adding a dependency to peerio-icebear, you should add it to both the dependencies and peerDependencies. 


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
