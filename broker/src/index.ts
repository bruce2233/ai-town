import { Broker } from './Broker';

const PORT = 8080;
const broker = new Broker(PORT);
broker.start();
