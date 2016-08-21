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
const name = argv.name ? argv.name : 'rebuzzer'
const port = argv.port ? argv.port : 7000
var commands = argv.command
const processStatusPollingInterval = 100
const currentProc = {}
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
		commands[index] = '' + commands[index]
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
		//console.log('START PROCESS', proc.pid, commands[index])
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

function waitUntilKilled(pid, callback) {
	if(isRunning(pid)) {
		setTimeout(function() {
			waitUntilKilled(pid, callback)
		}, processStatusPollingInterval)
		return
	}
	return callback(pid)
}

function killProcesses(callback) {
	var proc
	const toBeKilled = []
	const killingNow = []
	for(pid in currentProc) {
		proc = currentProc[pid]
		//console.log('COMMAND TO BE KILLED', pid)
		toBeKilled.push(pid)
		getAllChildProcessId(pid, function(children) {
			//console.log('CHILDREN:', children)
			for(index in children) {
				toBeKilled.push(children[index])
			}
			//console.log('TBK:', toBeKilled)
			async.whilst(
				function evaluation() {
					return toBeKilled.length > 0
				},
				function execution(evaluate) {
					process.kill(toBeKilled[0], 'SIGTERM')
					//console.log('KILL SEND TO', toBeKilled[0])
					killingNow.push(toBeKilled[0])
					toBeKilled.splice(0, 1)
					waitUntilKilled(killingNow[killingNow.length - 1], function(proc) {
						//console.log('PROCESS', proc, 'IS DEAD')
						if(proc in currentProc) {
							delete currentProc[proc]
						}
						killingNow.splice(killingNow.indexOf(proc), 1)
						if(killingNow.length < 1) {
							callback()
						}
					})
					evaluate()
				},
				function completion() {}
			)
		})
	}
}

function rerun() {
	//console.log('CURRENT RUNNIGN:', Object.keys(currentProc).length, Object.keys(currentProc))
	if(Object.keys(currentProc).length > 0) {
		readyToRerun = false
		io.emit('clickable', false)
		killProcesses(function() {
			//console.log('ALL PROCESSES ARE DEAD')
			startProcesses()
			readyToRerun = true
			io.emit('clickable', true)
		})
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