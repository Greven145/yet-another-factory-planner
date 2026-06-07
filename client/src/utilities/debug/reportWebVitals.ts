import { CLSMetric, FCPMetric, INPMetric, LCPMetric, TTFBMetric } from 'web-vitals';

type MetricReport = CLSMetric | FCPMetric | INPMetric | LCPMetric | TTFBMetric;

const reportWebVitals = (onPerfEntry?: (metric: MetricReport) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
      onCLS(onPerfEntry);
      onINP(onPerfEntry);
      onFCP(onPerfEntry);
      onLCP(onPerfEntry);
      onTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
