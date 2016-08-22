#! /usr/bin/env node

const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')
const async = require('async')
const isRunning = require('is-running')
const psTree = require('ps-tree')
const kill = require('tree-kill')
const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const argv = require('minimist')(process.argv.slice(2));
const page = {}
const color = argv.color ? argv.color : '255,255,255'
const interval = parseInt(argv.interval ? argv.interval : 0)
const nowait = argv.nowait ? true : false
const name = argv.name ? argv.name : 'rebuzzer'
const port = argv.port ? argv.port : 7000
var commands = argv.command
const processStatusPollingInterval = 100
var currentProc = {}
var readyToRerun = true

function verifyColor() {
	const error = new Error(
		'Wrong color: "'
		+ color
		+ '", RGB value expected'
	)
	if(!/^\d{1,3},\d{1,3},\d{1,3}$/.test(color)) {
		throw error
	}
	const rgb = color.split(',')
	for(index in rgb) {
		if(rgb[index] < 0 || rgb[index] > 255) {
			throw error
		}
	}
}

function verifyCommands() {
	if(!(argv.command instanceof Array)) {
		commands = [argv.command]
	}
	for(index in commands) {
		if(
			commands[index] === false
			|| commands[index] === true
			|| commands[index] === undefined
		) {
			commands.splice(index, 1)
			continue
		}
		commands[index] = '' + commands[index]
	}
	if(commands.length < 1) {
		throw new Error('No commands, expected at least one command')
	}
}

function verifyInterval() {
	if(!/^\d+$/.test(interval)) {
		throw new Error(
			'Invalid interval: "'
			+ interval
			+ '", milliseconds expected'
		)
	}
}

function getAllChildProcessId(pid, callback) {
	const result = []
	psTree(pid, function (err, children) {
		for(index in children) {
			result.push(children[index].PID)
		}
		callback(result)
	})
}

function startProcesses() {
	var proc
	for(index in commands) {
		proc = childProcess.exec(
			commands[index],
			{maxBuffer: 1048576},
			function(error, stdout, stderr) {}
		)
		proc.stdout.on('data', function(data) {
			process.stdout.write(data)
			proc.stdout = new Buffer(1048576)
		})
		proc.stderr.on('data', function(data) {
			process.stdout.write(data)
			proc.stderr = new Buffer(1048576)
		})
		currentProc[proc.pid] = proc
	}
}

function waitUntilKilled(processList, callback) {
	async.whilst(
		function() {
			return processList.length > 0
		},
		function(evaluate) {
			for(proc in processList) {
				var res = isRunning(processList[proc])
				if(!res) {
					processList.splice(proc, 1)
				}
			}
			if(processList.length < 1) {
				evaluate()
				return
			}
			setTimeout(function() {
				evaluate()
			}, processStatusPollingInterval)
		},
		function() {
			callback(processList)
		}
	)
}

function resolveProcesses(callback) {
	const commandProcs = Object.keys(currentProc)
	const allProcs = []
	async.whilst(
		function() {
			return commandProcs.length > 0
		},
		function(evaluate) {
			allProcs.push(commandProcs[0])
			getAllChildProcessId(commandProcs[0], function(children) {
				for(index in children) {
					allProcs.push(children[index])
				}
				commandProcs.splice(0, 1)
				evaluate()
			})
		},
		function() {
			callback(allProcs)
		}
	)
}

function killProcesses(callback) {
	resolveProcesses(function(toBeKilled) {
		for(index in toBeKilled) {
			try {
				process.kill(toBeKilled[index], 'SIGTERM')
			} catch(error) {
				//ignore process termination failure
			}
		}
		waitUntilKilled(toBeKilled, function(killed) {
			for(index in killed) {
				if(killed[index] in currentProc) {
					delete currentProc[killed[index]]
				}
			}
			if(callback) {
				callback()
			}
		})
	})
}

function rerun() {
	if(Object.keys(currentProc).length > 0) {
		readyToRerun = false
		io.emit('clickable', false)
		if(nowait) {
			killProcesses()
			startProcesses()
			readyToRerun = true
			io.emit('clickable', true)
		} else {
			killProcesses(function() {
				startProcesses()
				readyToRerun = true
				io.emit('clickable', true)
			})
		}
	} else if(readyToRerun) {
		readyToRerun = false
		io.emit('clickable', false)
		startProcesses()
		readyToRerun = true
		io.emit('clickable', true)
	}
}

io.on('connection', function(socket){
	//user connected
	socket.emit('data', JSON.stringify({
		color: color,
		commands: commands,
		name: name,
		interval: interval
	}))
	socket.on('rerun', rerun)
})

app.get('/', function(req, res) {
	res.set('Content-Type', 'text/html')
	res.send(page.index)
})

app.get('/index.html', function(req, res) {
	res.set('Content-Type', 'text/html')
	res.send(page.index)
})

app.get('/socketio.js', function(req, res) {
	res.set('Content-Type', 'text/html')
	res.send(page.socketio)
})

app.get('/jquery.js', function(req, res) {
	res.set('Content-Type', 'text/html')
	res.send(page.jquery)
})

page.index = fs.readFileSync(path.resolve(__dirname, './page/index.html'))
page.socketio = fs.readFileSync(path.resolve(__dirname, './page/socketio.js'))
page.jquery = fs.readFileSync(path.resolve(__dirname, './page/jquery.js'))

verifyColor()
verifyCommands()
verifyInterval()

http.listen(port, function() {
	console.log('rebuzzer started')
	console.log('  name: ' + name)
	console.log('  commands:')
	for(index in commands) {
		console.log('    ' + (parseInt(index) + 1) + ': "' + commands[index] + '"')
	}
	console.log('  port ' + port)
	if(interval > 0) {
		console.log('  interval: ' + interval)
	}
})
