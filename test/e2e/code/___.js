// this file gets loaded first (alphabetically) and we use it to initialize babel-register for all test runs
require('@babel/register')({
    extensions: ['.jsx', '.js', '.tsx', '.ts']
});
