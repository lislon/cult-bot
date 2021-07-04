module.exports = {
    reactStrictMode: true,
    // webpack (config) {
    //   config.externals = config.externals || {}
    //   config.externals.pay = 'foo'
    //   return config
    // }
    async rewrites() {
        return [
            {
                source: '/robots.txt',
                destination: '/api/robots'
            }
        ]
    }
}