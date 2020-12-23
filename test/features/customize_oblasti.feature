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
    Given Scene is 'customize_scene'

  Scenario: I can filter only temporary exhibition
    Given there is events:
      | title   | category     | tag_level_1                     | timetable        |
      | A       | exhibitions  | #постоянныеколлекции #доммузей  | вс: 21:59        |
    When I click markup [Рубрики]
    Then Bot responds 'Выберите рубрики' with inline buttons:
      """
      [➕ Кино ]
      [➕ Концерты ]
      [➕ Постоянные коллекции ]
      [➕ Временные выставки ]
      [➕ Театр ]
      [➕ Мероприятия ]
      [➕ Прогулки ]
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
      """
    When I click markup [Назад [к фильтрам]]
    Then Bot responds:
    """
    Текущая настройка фильтров:

    📎 <b>Рубрики</b>:  Дом-музей

    <b>1 событие</b> найдено
    """
    When I click markup [Показать события]
    Then Bot responds with event 'A'

  Scenario: I will see both #наука и #техника when select Научно-технические
    Given there is events:
      | title   | category     | tag_level_1                    | timetable        |
      | A       | exhibitions  | #постоянныеколлекции #наука    | вс: 21:59        |
      | B       | exhibitions  | #постоянныеколлекции #техника  | вс: 21:59        |
    When I click markup [Рубрики]
    When I click inline [Постоянные коллекции]
    When I click inline [Научно-технические]
    When I click markup [Назад [к фильтрам]]
    Then Bot responds:
    """
    Текущая настройка фильтров:

    📎 <b>Рубрики</b>:  Научно-технические

    <b>2 события</b> найдено
    """
    When I click markup [Показать события]
    Then Bot responds with event 'A'
    Then Bot responds with event 'B'
