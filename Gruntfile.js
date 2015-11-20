'use strict';

module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: true
            },
            src: ['bin/*']
        }
    });

    // Load grunt plugins for modules
    grunt.loadNpmTasks('grunt-contrib-jshint');

    // Register tasks
    grunt.registerTask('default', ['jshint']);
};
