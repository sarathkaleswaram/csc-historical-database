package ripple.importer;

import java.util.Map;

import org.apache.storm.task.ShellBolt;
import org.apache.storm.topology.IRichBolt;
import org.apache.storm.topology.OutputFieldsDeclarer;
import org.apache.storm.tuple.Fields;

public class PaymentsBolt extends ShellBolt implements IRichBolt {

  public PaymentsBolt() {
    super("node", "paymentsBolt.js");
  }

  @Override
  public void declareOutputFields(OutputFieldsDeclarer declarer) {
    System.out.println("declareOutputFields ------------------------------------ PaymentsBolt ");
  }

  @Override
  public Map<String, Object> getComponentConfiguration() {
    return null;
  }
}

