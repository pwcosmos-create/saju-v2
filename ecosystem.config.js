module.exports = {
  apps: [
    {
      name: 'saju-v2',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: '/home/ubuntu/saju-v2',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
  ],
};
