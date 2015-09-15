module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        def: {
            name: 'jsorolla',
            build: 'build/<%= pkg.version %>',
        },

        hub: {
            'lib': {
                src: ['Gruntfile-libcore.js','Gruntfile-libcommon.js','Gruntfile-libwidgets.js'],
                tasks: ['default']
            },

            'genome-viewer': {
                src: ['Gruntfile-genome-viewer.js'],
                tasks: ['default']
            },
            'genome-viewer-no-dep': {
                src: ['Gruntfile-genome-viewer.js'],
                tasks: ['no-dep']
            },


            'circular-genome-viewer': {
                src: ['Gruntfile-circular-genome-viewer.js'],
                tasks: ['default']
            },
            'circular-genome-viewer-no-dep': {
                src: ['Gruntfile-circular-genome-viewer.js'],
                tasks: ['no-dep']
            },

            'network-viewer': {
                src: ['Gruntfile-network-viewer.js'],
                tasks: ['default']
            },
            'network-viewer-no-dep': {
                src: ['Gruntfile-network-viewer.js'],
                tasks: ['no-dep']
            },

            'threed-viewer': {
                src: ['Gruntfile-threed-viewer.js'],
                tasks: ['default']
            },
            'threed-viewer-no-dep': {
                src: ['Gruntfile-threed-viewer.js'],
                tasks: ['no-dep']
            }
        },
        clean: {
            dist: ['<%= def.build %>/*']
        }
    })

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-hub');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('default', [
        'clean',
        'hub:lib',
        'hub:genome-viewer-no-dep',
        'hub:circular-genome-viewer-no-dep',
        'hub:network-viewer-no-dep',
        'hub:threed-viewer-no-dep',
    ]);

    grunt.registerTask('gv',  ['clean', 'hub:genome-viewer']);
    grunt.registerTask('cgv', ['clean', 'hub:circular-genome-viewer']);
    grunt.registerTask('nv',  ['clean', 'hub:network-viewer']);
    grunt.registerTask('3dv', ['clean', 'hub:threed-viewer']);
};
