module.exports = {
    apps: [{
      name: "stream-forge",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env_production: {
        NODE_ENV: "production",
        PORT: 10000
      }      
    }]
  }
  