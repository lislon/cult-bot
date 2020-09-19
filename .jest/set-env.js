console.log('test node_ENv = ' + process.env.NODE_ENV)
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
console.log('test node_ENv2 = ' + process.env.NODE_ENV)