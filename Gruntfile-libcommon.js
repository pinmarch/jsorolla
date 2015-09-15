module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        def: {
            name: 'libcommon',
            build: 'build/<%= pkg.version %>/<%= def.name %>'
        },
        concat: {
            dist: {
                src: [
                    //
                    'src/lib/cellbase-manager.js',
                    'src/lib/opencga-manager.js',
                    'src/lib/ensembl-manager.js',
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

