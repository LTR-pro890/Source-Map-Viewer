
const liveServer = require('live-server');

liveServer.start({
    root: './dist/',
    mount: [
        [ '/', './pages' ],
        [ '/', './css' ],
        [ '/shaders', './src/SourceEngine/shaders' ]
    ]
});
