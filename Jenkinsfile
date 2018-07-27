#!/usr/bin/env groovy

pipeline {
    agent any
    tools {
        nodejs 'Node 8.11.2'
    }
    stages {
        stage('install deps') {
            steps {
                script {
                    sh "yarn"
                }
            }
        }
        stage('run tests') {
            steps {
                script {
                    sh "yarn test-jenkins"
                    junit 'test-results.xml'
                }
            }
        }
    }
}
