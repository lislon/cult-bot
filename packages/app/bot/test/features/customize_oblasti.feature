Feature: Customize time
  I can select time when I want to see events

   январь 2020
   пн	вт	ср	чт	пт	сб	вс
            1	2	3	4	5
   6	7	8	9	10	11	12
   13	14	15	16	17	18	19
   20	21	22	23	24	25	26
   27	28	29	30	31

  Background:
    Given now is 2020-01-01 12:00
    Given Scene is 'customize_scene'

  Scenario: I can filter only temporary exhibition
    Given there is events:
      | title | category    | tag_level_1                    | timetable |
      | A     | exhibitions | #постоянныеколлекции #доммузей | вс: 21:59 |
    When I click inline [Рубрики]
    Then Bot edits inline buttons:
      """
      [➕ Кино ]
      [➕ Концерты ]
      [➕ Постоянные коллекции ]
      [➕ Временные выставки ]
      [➕ Театр ]
      [➕ Мероприятия ]
      [➕ Прогулки ]
      [◀️ Назад] [🎯 1 найдено]
      """
    When I click inline [Постоянные коллекции]
    Then Bot edits inline buttons:
      """
      [➕ Кино ]
      [➕ Концерты ]
      [➖ Постоянные коллекции ]
      [Художественные ]
      [Научно-технические ]
      [Гуманитарные ]
      [Дом-музей ]
      [➕ Временные выставки ]
      [➕ Театр ]
      [➕ Мероприятия ]
      [➕ Прогулки ]
      [◀️ Назад] [🎯 1 найдено]
      """
    When I click inline [Дом-музей]
    Then Bot edits inline buttons:
      """
      [➕ Кино ]
      [➕ Концерты ]
      [➖ Постоянные коллекции ✔]
      [Художественные ]
      [Научно-технические ]
      [Гуманитарные ]
      [Дом-музей ✔]
      [➕ Временные выставки ]
      [➕ Театр ]
      [➕ Мероприятия ]
      [➕ Прогулки ]
      [◀️ Назад] [🎯 1 найдено]
      """
    When I click inline [Назад]
    Then Bot edits text:
    """
    Настройки фильтра:

    <code> </code>📎 <b>Рубрики</b>:  Дом-музей

    🎯 1 событие найдено
    """
    When I click inline [🎯 1 найдено]
    Then Bot edits slider with event 'A'

  Scenario: I will see both #наука и #техника when select Научно-технические
    Given there is events:
      | title | category    | tag_level_1                   | timetable |
      | A     | exhibitions | #постоянныеколлекции #наука   | вс: 21:59 |
      | B     | exhibitions | #постоянныеколлекции #техника | вс: 21:59 |
    When I click inline [Рубрики]
    When I click inline [Постоянные коллекции]
    When I click inline [Научно-технические]
    When I click inline [2 найдено]
    Then Bot edits slider with event 'A'
    When I click slider next
    Then Bot edits slider with event 'B'
    Then Google analytics pageviews will be:
      | dp                          | dt                                             |
      | /customize/rubrics/         | Подобрать под интересы > Рубрики           |
      | /customize/rubrics/p1/TEST-0-a/ | Подобрать под интересы > Рубрики > A [1/2] |
      | /customize/rubrics/p2/TEST-1-b/ | Подобрать под интересы > Рубрики > B [2/2] |
