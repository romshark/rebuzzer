#! /usr/bin/env node

const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')
const kill = require('tree-kill')
const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const argv = require('optimist').argv
const page = {}
const color = argv.color ? argv.color : '255,255,255'
const interval = parseInt(argv.interval ? argv.interval : 0)
const command = argv.command ? argv.command : ''
const name = argv.name ? argv.name : 'rebuzzer'
const port = argv.port ? argv.port : 7000
var currentProc

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

function verifyCommand() {
	if(command.length < 1) {
		throw new Error('No command')
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

function startProcess(path) {
	currentProc = childProcess.exec(path,
		{
			maxBuffer: 1048576
		},
		function(error, stdout, stderr) {}
	)
	currentProc.stdout.on('data', function(data) {
		process.stdout.write(data)
		currentProc.stdout = new Buffer(1048576)
	})
	currentProc.stderr.on('data', function(data) {
		process.stdout.write(data)
		currentProc.stderr = new Buffer(1048576)
	})
}

function run() {
	if(currentProc !== undefined && currentProc.pid !== null) {
		kill(currentProc.pid, 'SIGTERM', function() {
			startProcess(command)
		})
	} else {
		startProcess(command)
	}
}

io.on('connection', function(socket){
	//user connected
	socket.emit('data', JSON.stringify({
		color: color,
		command: command,
		name: name,
		interval: interval
	}))
	socket.on('run', run)
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
verifyCommand()
verifyInterval()

http.listen(port, function() {
	console.log('rebuzzer started')
	console.log('  name: ' + name)
	console.log('  command: ' + command)
	console.log('  port ' + port)
	if(interval > 0) {
		console.log('  interval: ' + interval)
	}
})