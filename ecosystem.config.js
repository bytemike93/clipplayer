module.exports = {
    apps: [
        {
            name: "clipplayer",
            script: "server.js",
            env: {
                NODE_ENV: "production"
            },
            merge_logs: true,
            out_file: "./logs/clipplayer-out.log",
            error_file: "./logs/clipplayer-err.log"
        }
    ]
};
