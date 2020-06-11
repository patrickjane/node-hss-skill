# HSS - Skill

Node.JS library for creating skills based on the [Hermes Skill Server](https://github.com/patrickjane/hss-server).

A python library is also available, check out [HSS-Skill](https://github.com/patrickjane/hss-skill).

# Installation

```
$ npm install --save node-hss-skill
```

# Overview

The `node-hss-skill` module provides functions for quick and easy skill development for the [Hermes Skill Server](https://github.com/patrickjane/hss-server). The Hermes Skill Server is used for intent handling for MQTT/Hermes based voice assistants, such as [Rhasspy](rhasspy.readthedocs.io/) and (formerly) Snips.ai.

The module requires the developer to only provide a small number of functions, while the communication with the server, intent parsing and the like is covered by the module's functions.

# Getting started

Your skill implementation must provide the following components:

- installed `node-hss-skill` module
- `index.js` file as entrypoint
- `skill.json` file containing meta infos about your skill
- your skill implementation
- [optional] `config.ini.default` file containing your skill's configuration (default) parameters

## Boilerplate

Your `index.js` might be sufficient if it looks like this:

```
let base = require("node-hss-skill")(__dirname)    // important, must provide '__dirname'
let skill = require("./skill.js")(base)

base.run(skill);
```
## Your skill implementation

Whatever you provide as `skill` in the above example, must provide:

#### `function handle(params, answer, followup)`

A function which is called every time an intent which was registered by your skill is recognized and should be answered.

The `params` parameter is an object containing all necessary information to handle an intent. 

The parameters `answer` and `followup` are both callback functions, one of which must be called whenever your skill has finished intent handling. It will receive the answer determined by your skill and send it back to the server.

##### Parameter: `params` -> `{ sessionId, siteId, intentName, slots, _request }`

In addition to the siteId and sessionId, the name of the intent and the recognized slots (as an array of objects) are contained.
Additionally, the full (unparsed) original request is preserved in the `_request` property.

##### Callback function: `answer(err, response, lang)`

The callback function `answer` should be called when your skill is done handling the intent, and no further action is necessary. 

The first argument represents any error your skill encountered while processing the intent.     
The second parameter should be the response your skill determined (as **string**).     
The third (optional) parameter determines the associated language-code for the response, which will default to `en_GB` when ommitted.

##### Callback function: `followup(err, question, lang, intentFilter)`

The callback function `followup` should be called when your skill needs additional information, which should be asked from the user by the voice assistant. In this case, no response is returned yet, instead, usually a question is asked. 


The first argument represents any error your skill encountered while processing the intent.    
The second parameter should be the question which will be asked by the voice assistant (as **string**).     
The third (optional) parameter determines the associated language-code for the response, which will default to `en_GB` when ommitted.    
The last (optional) parameter can contain an array of strings representing a filter for intents which shall be applied when asking the user.

## Contents of `skill.json`

The `skill.json` is a mandatory file containing meta info about your skill. It is used both during installation as well as when your skill is run.

It could look like the following:

```
{
    "platform": "hss-node",
    "type": "weather",
    "name": "hss-s710-nodedemo",
    "version": "1.0.0",
    "author": "Some Dude",
    "intents": ["s710:howAreYou"]
}
```

Properties explained:

##### `platform` (mandatory)

Must be `hss-node`, stating the skill is a Node.JS based HSS skill.

#### `type` (mandatory)

Type of skill, e.g. `weather`. Must be one of:

- `weather`
- `calendar`
- `music`
- `datetime`
- `news`
- `games`
- `fun`
- `utility`
- `automation`

#### `version` (mandatory) 

The version number of the skill.

#### `author` (mandatory)

The name of the author of the skill.

#### `intents` (mandatory) 

An array of strings containing all intents the skill can handle.

## Base class functions

The `node-hss-skill` module also provides some convenience functions for your skill implementation to use.

##### Function: `say(text, lang, siteId, cb)`

Lets the voice assistant speak the given `text`, with optional language code (defaulting to `en_GB` and `siteId` (defaulting to `undefined`). 

If `cb` is given, it is executed after the text has been sent to the voice assistant.

##### Function: `ask(question, lang, siteId, intentFilter, cb)`

Lets the voice assistant speak the given `question`, with optional language code (defaulting to `en_GB` and `siteId` (defaulting to `undefined`). 

If `intentFilter` is given, it is expected to be an array of strings containing intents the voice assistant shall be restricted to when recognizing the user reply.

If `cb` is given, it is executed after the question has been sent to the voice assistant.

##### Function: `getLogger()`

Returns the `log` object the skill implementation can use for logging.

##### Function: `getConfig()`

Returns an object containing the parameters of the skill's `config.ini`, or `undefined` if the config file is not present or could not be read.

# Example

A minimal example of a skill (`index.js`) might look as:

```
function Skill(baseSkill) {

   let log = baseSkill.getLogger();
   let cfg = baseSkill.getConfig();
   let api = { handle };

   function handle(params, answer, followup) {
      log.info("I can use logging here, yay.");
      log.info("Some config.ini param: " + cfg.skill.someparam);

      setImmediate(() => answer(null, "I am fine, thanks"));
      
      // setImmediate(() => followup(null, "I am fine, and you?", "en_GB", ["s710:confirm", "s710:reject"]));
      
      setTimeout(later, 1500);
   }

   return api;
}

function later() {
   baseSkill.say('I just wanted to say something');
}

module.exports = Skill;
```

The design of the skill implementation (class, function, object, ...) is up to the developer, as long as the object provided to `base.run(skill);` provides the above mentioned mandatory functions.

# Configuration

If your skill needs its own configuration parameters which must be supplied by the user (e.g. access tokens, ...), you can provide a `config.ini.default` file. 

This file is meant to a) give default values for configuration options and b) contain empty configuration values, which must be filled by the user upon skill installation. See [Hermes Skill Server](https://github.com/patrickjane/hss-server) for details about skill installation.

Upon installation `config.ini.default` will be copied into `config.ini`, and values will be filled by the user. `config.ini.default` will remain untouched.

#### Example

```
[skill]
someparam = xxxxx
mustbefilled =
```

In code, you can access the configuration using the `baseSkill`'s `getConfig()` function. It will return an object resembling your configuration.

```
let config = baseSkill.getConfig();

let someparam = config.skill.someparam;

doSomethingWith(someparam);
```
