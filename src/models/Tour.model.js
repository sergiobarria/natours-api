import { model, Schema } from 'mongoose';

const tourSchema = new Schema({});

export const Tour = model('Tour', tourSchema);
