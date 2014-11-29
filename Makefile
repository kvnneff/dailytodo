BIN := ./node_modules/.bin
TESTS := $(shell find ./lib -name "test.js")

build: node_modules build-tests
	@$(BIN)/duo lib/index.js > build/index.js
	@$(BIN)/duo --use duo-suit-conformance lib/index.css > build/index.css
	@node build.js

example: node_modules
	@$(BIN)/duo index.{js,css} -o /build -g slider

build-tests:
	@$(BIN)/duo \
		test/index.js > build/tests.js \
		--development

node_modules:
	npm install

test: build-tests
	@$(BIN)/duo-test \
		-c 'make build' \
		--build build/tests.js \
		--reporter spec \
		browser

test-saucelabs:
	@$(BIN)/duo-test saucelabs -b ie:9..stable

clean:
	@rm -fr build/* components node_modules

.PHONY: clean test example build build-tests