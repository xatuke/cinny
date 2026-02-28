import { Widget } from 'matrix-widget-api';
import { IApp } from './SmallWidget';

export class CinnyWidget extends Widget {
  public constructor(private rawDefinition: IApp) {
    super(rawDefinition);
  }
}
