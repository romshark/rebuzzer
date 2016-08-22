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

* Rebuzzer can take multiple commands to be executed:
```bash
rebuzzer --command "echo FIRST" --command "echo SECOND"
```

* To make the buzzer inactive for *n* milliseconds after previous activation:
```bash
rebuzzer --interval 500
```

* To rerun commands without waiting for the termination of previously started child processes:
```bash
rebuzzer --nowait
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

```bash
rebuzzer --port 8080 --color 255,255,0 --name "Restart Script" --command "node somescript.js" --command "rm -rf temporary; node somescript.js" --command "sleep 2; node somescript.js &"
```

This example will run three commands simultaneously:

* The first command will start the **node somescript.js** as a child process.
* The second one will first remove file **temporary**, then start the **node somescript.js** as another child process.
* The third command will start **node somescript.js** as a separate background process.

When the buzzer is klicked repeatedly Rebuzzer will try to recursively shutdown all child processes by requesting graceful termination before it attempts to restart all 3 commands again. Notice Rebuzzer will fail to kill the third process due to the node script within it being started as a separate process.

During the shutdown of all 3 commands the buzzer won't trigger.

##Security
Please notice anyone on the network being able reach the host will also be able to trigger command restarts. Use with caution.