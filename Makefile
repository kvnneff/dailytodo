BIN := ./node_modules/.bin

build: node_modules build-tests
	@$(BIN)/duo --root lib/ index.js > build/index.js -o ../build
	@$(BIN)/duo --root lib/ index.css > build/index.css -o ../build
	@node build.js

example: node_modules
	@$(BIN)/duo index.{js,css} -o /build -g slider

build-tests:
	@$(BIN)/duo \
		test/index.js > build/tests.js \
		--development

node_modules:
	npm install

test: build
	@$(BIN)/duo-test \
		-c 'make build' \
		--build build/tests.js \
		--reporter spec \
		browser

test-saucelabs:
	@$(BIN)/duo-test saucelabs -b ie:9..stable

clean:
	@rm -fr build/* components node_modules

.PHONY: clean test example build