module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        def: {
            name: 'libwidgets',
            build: 'build/<%= pkg.version %>/<%= def.name %>'
        },
        concat: {
            dist: {
                src: [
                    //
                    'src/lib/grid.js',
                    //widgets
                    'src/lib/widgets/feature/file/file-widget.js',
                    'src/lib/widgets/feature/file/*.js',
                    'src/lib/widgets/feature/info/info-widget.js',
                    'src/lib/widgets/feature/info/*.js',

                    'src/lib/widgets/network/network-file-widget.js',
                    'src/lib/widgets/network/**/*.js',

                    //opencga
                    'src/lib/widgets/opencga/user-list-widget.js',
                    'src/lib/widgets/**/*.js',
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

