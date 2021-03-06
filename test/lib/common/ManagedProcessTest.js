var expect = require('chai').expect,
  sinon = require('sinon'),
  ManagedProcess = require('../../../lib/common/ManagedProcess'),
  EventEmitter = require('events').EventEmitter

describe('ManagedProcess', function () {
  var proc, socket

  beforeEach(function () {
    socket = 'foo'

    proc = new ManagedProcess({
      socket: socket
    })
    proc._config = {
      guvnor: {
        timeout: 5000
      }
    }
    proc._logger = {
      info: function () {
      },
      warn: function () {
      },
      error: function () {
      },
      debug: function () {
      }
    }
    proc._dnode = {
      connect: sinon.stub()
    }
  })

  it('should connect to the remote process RPC socket', function (done) {
    var dnode = {
      on: sinon.stub(),
      connect: sinon.stub()
    }

    proc._dnode = function () {
      return dnode
    }

    proc.connect(function (error, remote) {
      expect(error).to.not.exist

      expect(remote.kill).to.be.a('function')

      done()
    })

    expect(dnode.on.calledTwice).to.be.true
    expect(dnode.on.getCall(0).args[0]).to.equal('error')
    expect(dnode.on.getCall(1).args[0]).to.equal('remote')

    var readyCallback = dnode.on.getCall(1).args[1]

    readyCallback({
      foo: function () {
      }
    })
  })

  it('should survive dnode throwing an exception when connecting to the remote process RPC socket', function (done) {
    var error = new Error('Urk!')
    var dnode = {
      on: sinon.stub(),
      connect: sinon.stub().throws(error)
    }

    proc._dnode = function () {
      return dnode
    }

    proc.connect(function (er, remote) {
      expect(er).to.equal(error)

      done()
    })
  })

  it('should not connect when already connected', function (done) {
    proc._dnode = sinon.stub()

    proc._connected = true

    proc.connect(function (error) {
      expect(error).to.not.exist

      expect(proc._dnode.called).to.be.false

      done()
    })
  })

  it('should error if no socket is specified', function (done) {
    proc._connected = false
    proc.socket = null

    proc.connect(function (error) {
      expect(error).to.be.ok
      expect(error.message).to.contain('socket')

      done()
    })
  })

  it('should not connect when already connecting', function (done) {
    proc._dnode = sinon.stub()

    proc._connected = false
    proc._connecting = true

    proc.connect(function (error) {
      expect(error).to.not.exist

      expect(proc._dnode.called).to.be.false

      done()
    })

    proc.emit('_connected')
  })

  it('should defer dnode connection until method is invoked', function (done) {
    var dnode = {
      on: sinon.stub(),
      connect: sinon.stub()
    }

    proc._dnode = function () {
      return dnode
    }

    // should not have interacted with dnode yet
    expect(dnode.on.called).to.be.false

    // invoke the proxied method
    proc.kill(function () {
      expect(dnode.on.calledTwice).to.be.true
      expect(dnode.on.getCall(0).args[0]).to.equal('error')
      expect(dnode.on.getCall(1).args[0]).to.equal('remote')

      done()
    })

    var readyCallback = dnode.on.getCall(1).args[1]

    // simulate dnode having connected
    readyCallback({
      kill: sinon.stub().callsArg(0)
    })
  })

  it('should throw an exception via stub callback if none is passed and rpc method errors', function () {
    proc._connected = true
    proc._rpc.kill = sinon.stub().callsArgWith(0, new Error('Urk!'))

    expect(proc.kill).to.throw(Error)
  })

  it('should pass dnode errors to a callback', function (done) {
    var dnode = {
      on: sinon.stub(),
      connect: sinon.stub()
    }

    proc._dnode = function () {
      return dnode
    }

    proc.connect(function (error) {
      expect(error).to.be.ok

      done()
    })

    expect(dnode.on.calledTwice).to.be.true
    expect(dnode.on.getCall(0).args[0]).to.equal('error')
    expect(dnode.on.getCall(1).args[0]).to.equal('remote')

    var errorCallback = dnode.on.getCall(0).args[1]

    errorCallback(new Error('urk!'))
  })

  it('should end the dnode stream on disconnect', function () {
    var remote = {
      end: sinon.stub()
    }

    proc._remote = remote

    proc.disconnect()

    expect(remote.end.calledOnce).to.be.true
  })

  it('should not disconnect if already disconnected', function (done) {
    proc.disconnect(done)
  })

  it('should register callback to be called when remote has disconnected', function (done) {
    var remote = new EventEmitter()
    remote.end = sinon.stub()
    proc._remote = remote

    proc.disconnect(done)

    remote.emit('end')
  })

  it('should add a worker', function () {
    var worker = {
      id: 'foo'
    }

    proc = new ManagedProcess({
      socket: socket,
      cluster: true
    })

    proc.workers.push({
      id: 'bar'
    })

    proc.addWorker(worker)

    expect(proc.workers).to.contain(worker)
  })

  it('should not add a worker twice', function () {
    var worker = {
      id: 'foo'
    }

    proc = new ManagedProcess({
      socket: socket,
      cluster: true
    })

    proc.workers.push({
      id: 'bar'
    })

    proc.addWorker(worker)
    proc.addWorker(worker)

    expect(proc.workers.length).to.equal(2)
    expect(proc.workers).to.contain(worker)
  })

  it('should remove a worker', function () {
    var worker = {
      id: 'foo'
    }

    proc = new ManagedProcess({
      socket: socket,
      cluster: true
    })

    proc.workers.push(worker)
    proc.workers.push({
      id: 'bar'
    })

    proc.removeWorker(worker)

    expect(proc.workers).to.not.contain(worker)
  })

  it('should update process info', function () {
    var info = {
      name: 'foo'
    }

    proc.update(info)

    expect(proc.name).to.equal(info.name)
    expect(proc.setClusterWorkers).not.to.exist
    expect(proc.workers).not.to.exist
    expect(proc.addWorker).not.to.be.a('function')
    expect(proc.removeWorker).not.to.be.a('function')
  })

  it('should keep cluster properties for cluster manager', function () {
    var info = {
      name: 'foo',
      cluster: true
    }

    proc = new ManagedProcess({
      socket: socket,
      cluster: true
    })

    proc.update(info)

    expect(proc.name).to.equal(info.name)
    expect(proc.setClusterWorkers).to.be.a('function')
    expect(proc.workers).to.be.an('array')
    expect(proc.addWorker).to.be.a('function')
    expect(proc.removeWorker).to.be.a('function')
  })
})
