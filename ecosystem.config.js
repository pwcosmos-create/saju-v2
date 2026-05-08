module.exports = {
  apps: [
    {
      name: 'saju-v2',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      cwd: 'C:/dev/saju-v2',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
