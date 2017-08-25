Karma Page Runner
===========================

Karma plugins for loading, simulating user actions on testing pages.

## Testing

```
# Running End-to-End tests on PhantomJS, Chrome in Continuous Integration mode
npm run test:e2e --browsers=phantomjs,chrome

# Running unit tests on PhantomJS, Chrome
npm run test:unit --browsers=phantomjs,chrome

# Running End-to-End tests on Chrome, Firefox in debug mode
npm run test:e2e --debug --browsers=chrome,firefox

# Running the specified tests
npm run test:e2e --browsers=phantomjs --tests=<test-name-relative-e2e-base-path>
```
