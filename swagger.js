import swaggerAutogen from 'swagger-autogen';

const doc = {
  info: {
    version: '1.0.0',
    title: 'Natours API',
    description: 'Express API for the Natours application',
  },
  host: 'http://localhost:4000',
  basePath: '/',
  // schemes: []
};

const outputFile = './swagger.json';
const endpointsFiles = ['./src/routes/**/*.routes.js'];

swaggerAutogen()(outputFile, endpointsFiles, doc);
