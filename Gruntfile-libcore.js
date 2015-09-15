module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        def: {
            name: 'libcore',
            build: 'build/<%= pkg.version %>/<%= def.name %>'
        },
        concat: {
            dist: {
                src: [
                    //
                    'src/lib/utils.js',
                    'src/lib/svg.js',
                    'src/lib/region.js',
                    'src/lib/feature-binary-search-tree.js',
                    '!src/lib/worker-fileupload.js',

                    //network
                    'src/lib/network/**/*.js',

                    //data-source
                    'src/lib/data-source/data-source.js',
                    'src/lib/data-source/**/*.js',

                    //data-adapter
                    'src/lib/data-adapter/feature/feature-data-adapter.js',
                    'src/lib/data-adapter/feature/**/*.js',
                    'src/lib/data-adapter/network/**/*.js',

                    //cache
                    'src/lib/cache/memory-store.js',
                    'src/lib/cache/feature-chunk-cache.js',
                    'src/lib/cache/feature-cache.js',
                    'src/lib/cache/bam-cache.js'
                ],
                dest: '<%= def.build %>.js'
            }
        },
        uglify: {
            options: {
                banner: '/*! <%= def.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
            },
            dist: {
                src: ['<%= concat.dist.dest %>'],
                dest: '<%= def.build %>.min.js'
            }
        },
        clean: {
            dist: [
                '<%= concat.dist.dest %>',
                '<%= uglify.dist.dest %>'
            ]
        }

    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('default', ['clean', 'concat', 'uglify']);

};

