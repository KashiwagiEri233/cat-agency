/**
 * 剧情文本：《消失的金枪鱼罐头》。
 * 每个可交互物件根据当前任务状态返回不同对话，形成真实的线索链。
 */
import type { DialogueLine, SaveData } from './types';

export type StoryEffect =
  | 'readLetter'
  | 'readBoard'
  | 'searchCabinet'
  | 'findTuna'
  | 'complete'
  | null;

export interface StoryScene {
  lines: DialogueLine[];
  effect: StoryEffect;
}

const cat = (text: string): DialogueLine => ({ speaker: '阿橘', portrait: 'cat', text });
const client = (text: string): DialogueLine => ({ speaker: '琪琪', portrait: 'client', text });
const narrator = (text: string): DialogueLine => ({ speaker: '旁白', portrait: 'narrator', text });
const board = (text: string): DialogueLine => ({ speaker: '公告板', portrait: 'board', text });

export function introStory(save: SaveData): StoryScene {
  if (save.readLetter || save.completed) {
    return { lines: [], effect: null };
  }
  return {
    lines: [
      narrator('「叮铃——」事务所门上的黄铜小铃响了一声。'),
      narrator('没有客人进来——客人早就在了。三花猫琪琪蜷在地毯上，尾巴不安地拍着地板。'),
      cat('我是阿橘，猫咪事务所的所长。'),
      cat('今天的委托……好像有点急。先去看看桌上那封信吧。'),
    ],
    effect: null,
  };
}

export function storyFor(id: string, save: SaveData): StoryScene {
  switch (id) {
    case 'desk':
      return deskStory(save);
    case 'board':
      return boardStory(save);
    case 'cabinet':
      return cabinetStory(save);
    case 'box':
      return boxStory(save);
    case 'coffee':
      return coffeeStory();
    case 'window':
      return windowStory();
    case 'door':
      return doorStory(save);
    case 'client':
      return clientStory(save);
    default:
      return { lines: [cat('这里好像没什么特别的。')], effect: null };
  }
}

function clientStory(save: SaveData): StoryScene {
  if (save.completed) {
    return {
      lines: [
        client('谢谢你，阿橘所长！罐头我抱得紧紧的，这次绝对不会再弄丢啦。'),
        narrator('琪琪把罐头抱在怀里，尾巴尖轻轻翘着。'),
      ],
      effect: null,
    };
  }
  if (save.foundTuna) {
    return {
      lines: [
        client('喵！你手里那个……是不是我的罐头？'),
        cat('先别急，我们回办公桌前正式交接一下。'),
      ],
      effect: null,
    };
  }
  if (!save.readLetter) {
    return {
      lines: [
        client('我把委托信放在键盘旁边了……请一定要帮帮我。'),
        client('那是我攒了三个月猫爪币才买到的珍藏罐头。'),
      ],
      effect: null,
    };
  }
  if (!save.foundTuna) {
    return {
      lines: [
        client('拜托你了，阿橘所长……'),
        narrator('琪琪的尾巴一下一下拍着地毯。'),
      ],
      effect: null,
    };
  }
  return {
    lines: [client('喵……')],
    effect: null,
  };
}

function deskStory(save: SaveData): StoryScene {
  if (save.completed) {
    return {
      lines: [
        cat('今天的事务所，安静得刚刚好。'),
        narrator('桌上的咖啡还温着，窗外的云慢慢飘过去。'),
      ],
      effect: null,
    };
  }

  if (save.foundTuna) {
    return {
      lines: [
        client('喵——！就是它！就是它！'),
        client('谢谢你，阿橘所长！我昨晚是想把罐头藏起来，怕被别的猫偷吃……结果自己也忘了放在哪儿。'),
        cat('事务所温馨提示：贵重物品请勿藏在纸箱里。'),
        narrator('委托完成。获得 100 枚猫爪币。'),
        narrator('琪琪临走时留下一张新纸条：「下次的委托，可能在午夜之后……」'),
        narrator('任务《消失的金枪鱼罐头》已完成。'),
      ],
      effect: 'complete',
    };
  }

  if (!save.readLetter) {
    return {
      lines: [
        narrator('键盘旁边压着一封带着鱼腥味的信。'),
        client('喵——！我的珍藏金枪鱼罐头不见了！请帮帮我！'),
        client('我记得昨晚十一点还看见它……今早醒来，柜格里就空了。'),
        cat('案发时间：昨夜十一点。案发地点：事务所储藏室。'),
        cat('先去公告板看看——那里应该记着事务所的归档规矩。'),
      ],
      effect: 'readLetter',
    };
  }

  if (!save.readBoard) {
    return {
      lines: [
        cat('委托信上说，昨晚十一点罐头还在储藏室。'),
        cat('公告板上应该写着档案和记录的规矩，先去那边看看。'),
      ],
      effect: null,
    };
  }

  if (!save.searchedCabinet) {
    return {
      lines: [
        cat('登记簿放在档案柜第三层。'),
        cat('先去把昨晚的记录翻出来。'),
      ],
      effect: null,
    };
  }

  return {
    lines: [
      cat('登记簿上写着：储藏室归还纸箱一只。'),
      cat('箱子就在储藏室角落，去翻翻看。'),
    ],
    effect: null,
  };
}

function boardStory(save: SaveData): StoryScene {
  if (!save.readLetter) {
    return {
      lines: [
        cat('公告板上贴满了便签，最上面那张挡住了要紧的部分。'),
        cat('还是先看看办公桌上的委托信吧。'),
      ],
      effect: null,
    };
  }
  if (!save.readBoard) {
    return {
      lines: [
        narrator('公告板上贴着事务所的工作守则，还有一张你留给自己的便签。'),
        board('① 客户档案按月份归档。'),
        board('② 储藏室登记簿放在档案柜第三层。'),
        board('③ 请勿在纸箱里放零食。—— 所长阿橘'),
        cat('第三条……是我写的吗？我完全不记得了。'),
        cat('不管怎样，先去档案柜第三层找找登记簿。'),
      ],
      effect: 'readBoard',
    };
  }
  return {
    lines: [
      cat('公告板上的便签被风吹得轻轻摇晃。'),
      cat('「请勿在纸箱里放零食」——这句话越看越可疑。'),
    ],
    effect: null,
  };
}

function cabinetStory(save: SaveData): StoryScene {
  if (!save.readBoard) {
    return {
      lines: [
        cat('抽屉锁得严严实实。'),
        cat('公告板上好像写着记录的存放位置。'),
      ],
      effect: null,
    };
  }
  if (!save.searchedCabinet) {
    return {
      lines: [
        narrator('你拉开第三层抽屉，灰尘在暖光里翻了个身。'),
        narrator('一本薄薄的登记簿躺在最下面。'),
        cat('「昨日 23:07，储藏室归还纸箱一只。保管人：阿橘。」'),
        cat('咦？我昨晚确实搬过一个箱子……'),
        cat('它应该就在储藏室角落，那个塞满旧报纸的纸箱里。'),
      ],
      effect: 'searchCabinet',
    };
  }
  return {
    lines: [
      cat('登记簿上只有那一行字。'),
      cat('纸箱……就在储藏室角落。'),
    ],
    effect: null,
  };
}

function boxStory(save: SaveData): StoryScene {
  if (!save.searchedCabinet) {
    return {
      lines: [
        cat('一个塞满旧报纸的纸箱。'),
        cat('现在翻找，好像也说不出在找什么。'),
      ],
      effect: null,
    };
  }
  if (!save.foundTuna) {
    return {
      lines: [
        narrator('你扒开一层旧报纸，指尖碰到一个凉凉的铁罐。'),
        narrator('罐身贴着熟悉的标签——「金枪鱼 · 特级 · 琪琪的珍藏」。'),
        cat('找到了！它被报纸裹得严严实实，难怪谁都没发现。'),
        cat('快回去，把它还给琪琪。'),
      ],
      effect: 'findTuna',
    };
  }
  return {
    lines: [cat('箱子里只剩旧报纸了。罐头在我这儿。')],
    effect: null,
  };
}

let coffeeLine = 0;
const COFFEE_LINES: DialogueLine[][] = [
  [
    cat('咖啡凉了三分之一，正好入口。'),
    narrator('杯底沉着一小块没化开的糖，像一枚琥珀。'),
  ],
  [
    cat('上午的第三杯。猫咪事务所的咖啡消耗量总是不小。'),
    narrator('杯沿上留着一圈小小的猫胡子印。'),
  ],
  [
    cat('喝完这口，就要继续工作啦。'),
    narrator('窗外有只鸟飞过，阿橘假装没看见。'),
  ],
];

function coffeeStory(): StoryScene {
  const lines = COFFEE_LINES[coffeeLine % COFFEE_LINES.length];
  coffeeLine++;
  return { lines, effect: null };
}

function windowStory(): StoryScene {
  return {
    lines: [
      narrator('窗外是慢慢流动的云，和远处屋顶的剪影。'),
      cat('天气：晴，风力二级。适合晒尾巴。'),
      cat('如果下雨的话，委托人们大概会改天再来吧。'),
    ],
    effect: null,
  };
}

function doorStory(save: SaveData): StoryScene {
  const lines: DialogueLine[] = [
    narrator('门上的黄铜铃轻轻晃了两下，没有客人。'),
    cat('事务所今天也在营业中。'),
  ];
  if (save.completed) {
    lines.push(cat('也许下一个委托人，已经在路上了。'));
  }
  return { lines, effect: null };
}
