const test = require('tape')
var Server = require('scuttle-testbot')
const ssbKeys = require('ssb-keys')
var caps = require('ssb-caps')
const OffsetLog = require('flumelog-offset')
const Flume = require('flumedb')
const codec = require('flumecodec/json')
const path = require('path')
const pull = require('pull-stream')
const ooo = require('ssb-ooo')

var ViewHashTable = require('flumeview-hashtable')

test('get invalid msg by ooo', t => {
  const keyMe = ssbKeys.generate()
  const keyTrickster = ssbKeys.generate()
  const keyOther = ssbKeys.generate()

  console.log("me:", keyMe.public)
  console.log("trickster:", keyTrickster.public)
  console.log("other:", keyOther.public)
  
  const serverMe = Server({name: 'ooo-hack-me', keys: keyMe})

  Server = Server.use(ooo)
  const serverOther = Server({name: 'ooo-hack-other', keys: keyOther})

  const msg = { type: 'post', text: 'My first message' }

  serverMe.publish(msg, (err, savedMsg) => {
    if (err) console.error(err)

    //console.log(savedMsg)

    // could hack the key and link to that or just reuse key
    savedMsg.key = "%RvRV01U11ifrT4YaDznX3RQpv1VMkEiud+HZa5hazeA=.sha256"
    savedMsg.value.content.text = "Hack the planet"

    var dbTrickster = Flume(OffsetLog(
      '/tmp/ooo-hack-trickster/ooo/log.offset',
      {blockSize:1024*16, codec:codec}
    )).use('keys', ViewHashTable(2, function (key) {
      var b = Buffer.from(key.substring(1,7), 'base64').readUInt32BE(0)
      return b
    }))

    dbTrickster.append(savedMsg, (err, r) => {
      if (err) console.error(err)

      dbTrickster.close(() => {

        var serverTrickster = require('secret-stack')({
          caps: { shs: Buffer.from(caps.shs, 'base64') },
          keys: keyTrickster,
          path: '/tmp/ooo-hack-trickster/'
        })
            .use(require('ssb-db'))
            .use(require('ssb-ooo'))()

        serverTrickster.connect(serverOther.address(), () => {
          console.log("connected, ooo get key", savedMsg.key)
          
          serverOther.ooo.get(savedMsg.key, (err, msg) => {
            console.log("get err", err)
            console.log("trickster log", msg)
          })
        })
      })
    })
  })
})
