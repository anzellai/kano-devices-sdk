#!groovy

@Library('kanolib') _

pipeline {
    agent {
        label 'ubuntu_18.04'
    }
    tools {
        nodejs 'Node 8.11.2'
    }
    post {
        always {
            junit allowEmptyResults: true, testResults: 'test-results.xml'
            junit allowEmptyResults: true, testResults: 'cordova-test-results.xml'
            step([$class: 'CheckStylePublisher', pattern: 'eslint.xml'])
        }
    }
    stages {
        stage('tools') {
            def YARN_PATH = tool name: 'yarn'
            env.PATH = "${env.PATH}:${YARN_PATH}/bin"
        }
        stage('install deps') {
            steps {
                script {
                    sh "yarn"
                }
            }
        }
        stage('checkstyle') {
            steps {
                script {
                    sh "yarn checkstyle-ci"
                }
            }
        }
        stage('run tests') {
            steps {
                script {
                    install_chrome_dependencies()
                    sh "yarn test-ci"
                    sh "yarn test-cordova-ci"
                }
            }
        }
    }
}
