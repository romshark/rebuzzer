# Rebuzzer

Rebuzzer is a fullscreen button in the browser which (re)executes a command on the server by clicking on it.

Internally Rebuzzer is using a persistent WebSocket connection to ensure low latency.

## Getting Started

Just install rebuzzer by
```bash
npm install -g rebuzzer
```
And start it on the machine you want the command to be executed on by
```bash
rebuzzer --command "echo do something"
```

This will start rebuzzer on its default port. You can then navigate your web browser on any device in the network to http://youserver:7000 and tap the page for the command to be executed.

When rebuzzer is executed repeatedly it will automatically kill the process started when the previous command was run and then rerun the command again.

## Options

* Rebuzzer can take a series of commands:
```bash
rebuzzer --command "echo FIRST; echo SECOND"
```

* You can tweak the appearance by providing a color in RGB format:
```bash
rebuzzer --color 255,255,0
```

* You can also change the name of the buzzer:
```bash
rebuzzer --name MyBuzzer
```

* The port Rebuzzer is listening to can be changed by:
```bash
rebuzzer --port 8080
```

##Example
This will remove file **temporary**, then start **node somescript.js**. When the buzzer is klicked repeatedly Rebuzzer will kill the previously started **node somescript.js** process and all of its child processes, then remove **temporary** and then run **node somescript.js** again.
```bash
rebuzzer --port 8080 --color 255,255,0 --name "Restart Script" --command "rm -rf temporary; node somescript.js"
```

##Security
Please notice anyone on the network being able reach the host will also be able to trigger the command restart. Use with caution.