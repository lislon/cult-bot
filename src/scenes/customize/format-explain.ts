import { ContextMessageUpdate } from '../../interfaces/app-interfaces';
import { ruFormat } from '../shared/shared-logic';
import { addDays, startOfDay, startOfISOWeek } from 'date-fns/fp'
import flow from 'lodash/fp/flow'

function joinTimeIntervals(time: string[], onlyWeekday: 'saturday' | 'sunday') {
  return time
    .sort()
    .map((t) => t.split(/[-.]/))
    .filter(([day]) => day === onlyWeekday)
    .map(([, from, to]) => [+from.replace(/:.+/, ''), +to.replace(/:.+/, '')])
    .reduceRight((acc: number[][], [from, to]) => {
      if (acc.length > 0 && to === acc[0][0]) {
        acc[0][0] = from;
      } else {
        acc = [[from, to], ...acc];
      }
      return acc;
    }, [])
    .map(([from, to]) => [from, to === 0 ? 24 : to])
    .map(([from, to]) => `${from}.00-${to}.00`)
}

const DATE_FORMAT = 'dd.MM'
const WEEKDAY_NAME_FORMAT = 'eeeeee'

export function formatExplainTime(
  ctx: ContextMessageUpdate,
  i18Msg: (id: string, tplData?: object, byDefault?: string) => string
): string[] {
  const { time } = ctx.session.customize;
  if (time.length === 0) {
    return [];
  }
  const lines = [];
  const startOfWeekends = flow(startOfISOWeek, startOfDay, addDays(5))(ctx.now())
  const weekdays = [joinTimeIntervals(time, 'saturday'), joinTimeIntervals(time, 'sunday')];
  const moments = [0, 1].map((i) =>
    flow(startOfDay, addDays(i))(startOfWeekends)
  );

  if (
    weekdays[0].length > 0 &&
    weekdays[1].length > 0 &&
    JSON.stringify(weekdays[0]) !== JSON.stringify(weekdays[1])
  ) {
    lines.push(i18Msg('explain_filter.time'));

    for (let i = 0; i < 2; i++) {
      lines.push(
        ' - ' +
          i18Msg('explain_filter.time_line', {
            weekday: ruFormat(moments[i], WEEKDAY_NAME_FORMAT).toUpperCase(),
            date: ruFormat(moments[i], DATE_FORMAT),
            timeIntervals: weekdays[i].join(', '),
          })
      );
    }
  } else if (weekdays[0].length === 0 || weekdays[1].length === 0) {
    for (let i = 0; i < 2; i++) {
      if (weekdays[i].length > 0) {
        lines.push(
          i18Msg('explain_filter.time') +
            ' ' +
            i18Msg('explain_filter.time_line', {
              weekday: ruFormat(moments[i], WEEKDAY_NAME_FORMAT).toUpperCase(),
              date: ruFormat(moments[i], DATE_FORMAT),
              timeIntervals: weekdays[i].join(', '),
            })
        );
      }
    }
  } else {
    const [from, to] = moments.map((t) => ruFormat(t, DATE_FORMAT))
    lines.push(
      `${i18Msg('explain_filter.time')} СБ (${from}) - ВС (${to}): ${weekdays[0].join(', ')}`
    );
  }
  lines.push('');
  return lines;
}

const MAX_LINE_LEN = 40;

export function formatExplainOblasti(
  ctx: ContextMessageUpdate,
  i18Msg: (id: string, tplData?: object, byDefault?: string) => string
): string[] {
  const { oblasti } = ctx.session.customize;
  const oblastiNice = oblasti.map((o) =>
    i18Msg(`explain_filter.oblasti_section.${o}`, {}, i18Msg(`keyboard.oblasti_section.${o}`))
  );
  if (oblastiNice.length === 0) {
    return [];
  }
  let lines: string[] = [];

  if (oblastiNice.join(', ').length <= MAX_LINE_LEN) {
    lines.push(i18Msg('explain_filter.oblasti') + ' ' + oblastiNice.join(', '));
  } else {
    lines.push(i18Msg('explain_filter.oblasti'));

    lines = [
      ...lines,
      ...oblastiNice.map((o) => {
        return ' - ' + o;
      }),
    ];
  }
  lines.push('');
  return lines;
}

export function formatExplainCennosti(
  ctx: ContextMessageUpdate,
  i18Msg: (id: string, tplData?: object, byDefault?: string) => string
): string[] {
  const { cennosti } = ctx.session.customize;
  const cennostiNice = cennosti.map((o) =>
    i18Msg(`explain_filter.cennosti_section.${o}`, {}, i18Msg(`keyboard.cennosti_section.${o}`))
  );
  if (cennostiNice.length === 0) {
    return [];
  }
  let lines: string[] = [];

  if (cennostiNice.join(', ').length <= MAX_LINE_LEN) {
    lines.push(i18Msg('explain_filter.cennosti') + ' ' + cennostiNice.join(', '));
  } else {
    lines.push(i18Msg('explain_filter.cennosti'));

    lines = [
      ...lines,
      ...cennostiNice.map((o) => {
        return ' - ' + o;
      }),
    ];
  }
  lines.push('');
  return lines;
}

export function formatExplainFormat(
  ctx: ContextMessageUpdate,
  i18Msg: (id: string, tplData?: object, byDefault?: string) => string
): string[] {
  const { format } = ctx.session.customize;
  const formatNice = format.map((o) => i18Msg(`explain_filter.format_section.${o}`));
  if (formatNice.length !== 1) {
    return [];
  }
  return [i18Msg('explain_filter.format', { format: formatNice.join(', ') }), ''];
}
